// Carrega o banco de licenças de importação ("BD Itens Amparados Inciso V")
// da planilha FLUXOGRAMA DE IMPORTAÇÃO.xlsx para a tabela `products`.
// Rodar com: npx tsx db/seed-inciso-v.ts
//
// Decisões de normalização (a planilha não tem um campo de SKU interno):
// - sku: baseado em "Modelo", deduplicado com sufixo " (2)", " (3)"...
//   quando o mesmo modelo aparece em mais de uma licença (ex: "NOVA II 2x1"
//   aparecia 5x). O texto original do modelo fica preservado em
//   manufacturerSku, sem dedupe.
// - status: "DEFERIDO"/"DEFERIDA" -> DEFERIDA; "INDEFERIDO/A" e "CANCELADA"
//   -> CANCELADA_INDEFERIDA; "EM ANALISE" -> PARA_ANALISE (mesma coisa,
//   grafias diferentes na planilha); "EM EXIGÊNCIA" -> EM_EXIGENCIA (status
//   novo, adicionado ao enum só depois de ver esse dado real).
// - ncm "XXXXXXXX" (27 linhas) e customsBrokerRef "#REF!" (48 linhas) são
//   erros de fórmula/placeholder da planilha original — tratados como nulos,
//   nunca gravados como se fossem dado real.
// - description ausente (36 linhas): cai para "Modelo: {model}".
// - defaultSupplierId: ligado automaticamente quando o nome do fabricante
//   contém "aputure" ou "swit" (os únicos 2 fabricantes reais nos dados,
//   com variações de grafia tipo "SWIT" vs "Swit Eletronics Co., Ltd.").

import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import path from "node:path";
import { sql as dsql } from "drizzle-orm";
import { db } from "./client";
import { products, suppliers } from "./schema";

type RawRow = {
  importer: string | null;
  licenseNumber: string | null;
  licenseRegisteredAt: string | null;
  manufacturerName: string | null;
  exporterName: string | null;
  series: string | null;
  model: string | null;
  ncmAnterior: string | null;
  ncm: string | null;
  description: string | null;
  publicConsultationRef: string | null;
  licenseApprovedAt: string | null;
  status: string | null;
  notes: string | null;
  customsBrokerRef: string | null;
  active: string | null;
  updatedAt: string | null;
};

const STATUS_MAP: Record<string, (typeof products.$inferInsert)["licenseStatus"]> = {
  "DEFERIDA": "DEFERIDA",
  "DEFERIDO": "DEFERIDA",
  "INDEFERIDA": "CANCELADA_INDEFERIDA",
  "INDEFERIDO": "CANCELADA_INDEFERIDA",
  "CANCELADA": "CANCELADA_INDEFERIDA",
  "EM EXIGÊNCIA": "EM_EXIGENCIA",
  "PARA ANALISE": "PARA_ANALISE",
  "EM ANALISE": "PARA_ANALISE",
};

function sanitizeSku(model: string | null): string {
  const base = model?.trim();
  return base && base.length > 0 ? base : "SEM-MODELO";
}

async function main() {
  const dataPath = path.join(__dirname, "inciso-v-data.json");
  const rows: RawRow[] = JSON.parse(readFileSync(dataPath, "utf-8"));

  const supplierRows = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers);
  function findSupplierId(manufacturerName: string | null): string | null {
    if (!manufacturerName) return null;
    const lower = manufacturerName.toLowerCase();
    if (lower.includes("aputure")) {
      return supplierRows.find((s) => s.name.toUpperCase() === "APUTURE")?.id ?? null;
    }
    if (lower.includes("swit")) {
      return supplierRows.find((s) => s.name.toUpperCase() === "SWIT")?.id ?? null;
    }
    return null;
  }

  const existingSkus = new Set(
    (await db.select({ sku: products.sku }).from(products)).map((p) => p.sku),
  );

  const values: (typeof products.$inferInsert)[] = [];
  let skippedNoDescriptionFallback = 0;

  for (const row of rows) {
    let sku = sanitizeSku(row.model);
    let suffix = 2;
    while (existingSkus.has(sku)) {
      sku = `${sanitizeSku(row.model)} (${suffix})`;
      suffix++;
    }
    existingSkus.add(sku);

    let description = row.description;
    if (!description) {
      description = `Modelo: ${row.model ?? "não informado"}`;
      skippedNoDescriptionFallback++;
    }

    const ncm = row.ncm && row.ncm !== "XXXXXXXX" ? row.ncm : null;
    const customsBrokerRef = row.customsBrokerRef && row.customsBrokerRef !== "#REF!" ? row.customsBrokerRef : null;
    const licenseStatus = row.status ? STATUS_MAP[row.status] ?? null : null;

    const notesParts = [row.series ? `Série: ${row.series}` : null, row.notes].filter(Boolean);

    values.push({
      sku,
      manufacturerSku: row.model,
      ncm,
      ncmAnterior: row.ncmAnterior,
      description,
      manufacturerName: row.manufacturerName,
      exporterName: row.exporterName,
      licenseNumber: row.licenseNumber,
      licenseRegisteredAt: row.licenseRegisteredAt,
      licenseStatus,
      publicConsultationRef: row.publicConsultationRef,
      licenseApprovedAt: row.licenseApprovedAt,
      customsBrokerRef,
      active: true,
      defaultSupplierId: findSupplierId(row.manufacturerName),
      notes: notesParts.length > 0 ? notesParts.join(" | ") : null,
    } as typeof products.$inferInsert);
  }

  const CHUNK = 50;
  let inserted = 0;
  for (let i = 0; i < values.length; i += CHUNK) {
    const chunk = values.slice(i, i + CHUNK);
    await db.insert(products).values(chunk);
    inserted += chunk.length;
  }

  console.log(`Importados ${inserted} produtos (Inciso V).`);
  console.log(`${skippedNoDescriptionFallback} sem descrição na planilha, usado fallback "Modelo: X".`);

  const [{ count }] = await db.select({ count: dsql<number>`count(*)`.mapWith(Number) }).from(products);
  console.log(`Total de produtos na tabela agora: ${count}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
