// Recruza o catálogo de produtos contra a lista oficial do Decex
// ("Relação dos resultados das apurações de produção nacional", art. 42
// da Portaria Secex nº 249/2023) e mantém os campos ncmDivergent /
// ncmOfficialSuggested / ncmCheckedAt em `products` atualizados.
//
// Roda via `npm run ncm:sync` (local) ou agendado pelo GitHub Actions
// (.github/workflows/ncm-sync.yml). Idempotente — pode rodar quantas
// vezes quiser sem duplicar nada.
//
// A URL do .ods muda a cada atualização do governo (o nome do arquivo
// tem a data embutida), então primeiro buscamos o HTML da página pra
// descobrir o link atual, em vez de fixar uma URL.

import { config } from "dotenv";
config({ path: ".env.local" });
import { eq } from "drizzle-orm";
import { read, utils } from "xlsx";
import { db } from "./client";
import { products } from "./schema";

const LISTING_PAGE = "https://www.gov.br/siscomex/pt-br/informacoes/importacao";
const ODS_LINK_PATTERN = /href="([^"]*Relacao_dos_resultados_das_apuracoes[^"]*\.ods)"/i;

async function findCurrentOdsUrl(): Promise<string> {
  const res = await fetch(LISTING_PAGE, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Falha ao buscar ${LISTING_PAGE}: HTTP ${res.status}`);
  const html = await res.text();
  const match = html.match(ODS_LINK_PATTERN);
  if (!match) {
    throw new Error(
      "Não encontrei o link da lista de apurações de produção nacional na página do gov.br — a estrutura do site pode ter mudado.",
    );
  }
  return match[1];
}

type GovRow = { model: string; ncm: string };

async function downloadAndParse(url: string): Promise<GovRow[]> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Falha ao baixar ${url}: HTTP ${res.status}`);
  const buffer = new Uint8Array(await res.arrayBuffer());

  const wb = read(buffer, { type: "array" });
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("consolidada")) ?? wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  // header:1 -> array de arrays; pula as 2 primeiras linhas (título mesclado
  // + cabeçalho de coluna) e lê por posição: NCM, Descrição, Fabricante,
  // Marca, Modelo/Identificador Decex, Fabricante Nacional, Consulta Pública.
  const raw = utils.sheet_to_json<unknown[]>(sheet, { header: 1, range: 2 });

  const rows: GovRow[] = [];
  for (const r of raw) {
    const ncm = String(r[0] ?? "").trim();
    const model = String(r[4] ?? "").trim();
    if (!ncm || !model) continue;
    rows.push({ model, ncm });
  }
  return rows;
}

function normalize(ncm: string | null) {
  return (ncm ?? "").replace(/\D/g, "");
}

async function main() {
  const odsUrl = await findCurrentOdsUrl();
  console.log(`Lista encontrada: ${odsUrl}`);

  const govRows = await downloadAndParse(odsUrl);
  console.log(`Linhas na lista do governo: ${govRows.length}`);

  const dbProducts = await db
    .select({
      id: products.id,
      sku: products.sku,
      manufacturerSku: products.manufacturerSku,
      ncm: products.ncm,
      ncmDivergent: products.ncmDivergent,
    })
    .from(products);

  const bySkuLower = new Map(dbProducts.map((p) => [p.sku.toLowerCase(), p]));
  const byMfgSkuLower = new Map(
    dbProducts.filter((p) => p.manufacturerSku).map((p) => [p.manufacturerSku!.toLowerCase(), p]),
  );

  let filled = 0;
  let formatted = 0;
  let newDivergences = 0;
  let resolvedDivergences = 0;
  const seen = new Set<string>();

  for (const row of govRows) {
    const key = row.model.toLowerCase();
    const product = bySkuLower.get(key) ?? byMfgSkuLower.get(key);
    if (!product || seen.has(product.id)) continue;
    seen.add(product.id);

    if (!product.ncm) {
      await db
        .update(products)
        .set({ ncm: row.ncm, ncmDivergent: false, ncmOfficialSuggested: null, updatedAt: new Date() })
        .where(eq(products.id, product.id));
      filled++;
    } else if (normalize(product.ncm) === normalize(row.ncm)) {
      const needsFormatFix = product.ncm !== row.ncm;
      if (needsFormatFix) {
        await db
          .update(products)
          .set({ ncm: row.ncm, updatedAt: new Date() })
          .where(eq(products.id, product.id));
        formatted++;
      }
      if (product.ncmDivergent) {
        await db
          .update(products)
          .set({ ncmDivergent: false, ncmOfficialSuggested: null, updatedAt: new Date() })
          .where(eq(products.id, product.id));
        resolvedDivergences++;
      }
    } else {
      await db
        .update(products)
        .set({
          ncmDivergent: true,
          ncmOfficialSuggested: row.ncm,
          ncmCheckedAt: new Date().toISOString().slice(0, 10),
          updatedAt: new Date(),
        })
        .where(eq(products.id, product.id));
      newDivergences++;
    }
  }

  console.log(`NCM preenchido (estava vazio): ${filled}`);
  console.log(`NCM padronizado (formato, mesmo valor): ${formatted}`);
  console.log(`Divergências marcadas/atualizadas: ${newDivergences}`);
  console.log(`Divergências resolvidas automaticamente (lista passou a bater): ${resolvedDivergences}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
