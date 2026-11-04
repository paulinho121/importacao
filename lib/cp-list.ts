// Varredura da lista pública do governo ("Relação dos resultados das
// apurações de produção nacional", art. 42 da Portaria Secex nº 249/2023)
// contra o catálogo de produtos. A planilha (.ods, ~9 MB) é lida no
// navegador de quem faz o upload — só o resultado da conferência (dezenas
// de linhas) vai pro servidor, em vez do arquivo inteiro.

import { matchLpcoSheet, parseLpcoSheet, type LpcoSheetImport } from "@/lib/lpco-sheet";
import { matchIncisoBase, parseIncisoSheet, type IncisoImport } from "@/lib/inciso-base";

export type CpListResult = "FOUND" | "FOUND_NATIONAL" | "FOUND_APPROX" | "NOT_FOUND";

export const CP_LIST_RESULT_LABEL: Record<CpListResult, string> = {
  FOUND: "Deferido (consta na lista)",
  FOUND_NATIONAL: "Consta com fabricante nacional",
  FOUND_APPROX: "Possível correspondência — conferir",
  NOT_FOUND: "Não consta (aguardando)",
};

export const CP_LIST_RESULT_CLASS: Record<CpListResult, string> = {
  FOUND: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  FOUND_NATIONAL: "bg-warning/20 text-warning",
  FOUND_APPROX: "bg-secondary-fixed text-on-secondary-fixed-variant",
  NOT_FOUND: "bg-surface-container-high text-on-surface-variant",
};

export type CpListProduct = { id: string; sku: string; manufacturerSku: string | null; description?: string };

export type CpListMatch = {
  productId: string;
  result: "FOUND" | "FOUND_NATIONAL" | "FOUND_APPROX";
  ref: string;
  ncm: string | null;
};

type ListRow = { ncm: string; nationalMaker: boolean; cp: string };

// "Consulta Pública" vem como texto ("35/26"). Em alguns .ods o programa leu
// células como data ("01/20" virava "Invalid Date"): só aceita texto, pra não
// gravar lixo como número de CP.
const cpText = (v: unknown) => (typeof v === "string" && !/invalid date/i.test(v) ? v.trim() : "");

// Comparação exata: ignora maiúsculas/minúsculas e espaços sobrando.
const norm = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ").toLowerCase();

// Tira o que está entre parênteses: nossos nomes trazem a versão/região
// ("amaran Ray 60c (US)", "STORM XT52(EU CEE 32A)") e o governo lista o modelo
// puro ("Amaran Ray 60c"). Ignora também parênteses de largura total (（ ）).
const withoutParens = (v: unknown) => String(v ?? "").replace(/[(（][^)）]*[)）]/g, " ");

// Comparação aproximada: ignora também acentos, espaços e pontuação
// ("LIGHT DOME 150" = "LIGHTDOME150", "A1-600" = "A1600"). Exige 5+
// caracteres pra SKUs curtos não casarem com qualquer coisa.
const MIN_LOOSE_LENGTH = 5;
const loose = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove os acentos separados pelo NFD
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// "Consulta Pública" vem como "35/26": ordena pelo ano (depois pelo número)
// pra mostrar as mais recentes primeiro.
function cpSortKey(cp: string) {
  const [n, y] = cp.split("/");
  return `${(y ?? "").padStart(2, "0")}${(n ?? "").padStart(3, "0")}`;
}

// Aceita os dois formatos de planilha pelo cabeçalho: a lista pública do
// governo (.ods) ou a planilha de controle de LPCOs da MCI (.xlsx).
export type UploadScan =
  | { kind: "decex"; matches: CpListMatch[] }
  | { kind: "lpco"; import: LpcoSheetImport }
  | { kind: "inciso"; import: IncisoImport };

export async function scanUpload(file: File, products: CpListProduct[]): Promise<UploadScan> {
  const { read, utils } = await import("xlsx");
  const wb = read(new Uint8Array(await file.arrayBuffer()), { type: "array" });

  // 0) base de itens do Inciso V (cabeçalho "Importador/Solicitante … Modelo …").
  // Quando há mais de uma aba com o formato, usa a que tem mais itens.
  const incisoSets = wb.SheetNames.map((name) =>
    parseIncisoSheet(utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: "" })),
  ).filter((r) => r.length > 0);
  if (incisoSets.length > 0) {
    const best = incisoSets.sort((a, b) => b.length - a.length)[0];
    return {
      kind: "inciso",
      import: matchIncisoBase(
        best,
        products.map((p) => ({ id: p.id, sku: p.sku, manufacturerSku: p.manufacturerSku, description: p.description ?? "" })),
      ),
    };
  }

  // 1) planilha de controle de LPCOs (cabeçalho "LPCO | Produto …")
  for (const name of wb.SheetNames) {
    const rows = utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: "" });
    const records = parseLpcoSheet(rows);
    if (records.length > 0) {
      return {
        kind: "lpco",
        import: matchLpcoSheet(
          records,
          products.map((p) => ({ id: p.id, sku: p.sku, manufacturerSku: p.manufacturerSku, description: p.description ?? "" })),
        ),
      };
    }
  }

  // 2) lista pública do governo (cabeçalho "NCM … Modelo / Identificador Decex")
  return { kind: "decex", matches: scanCpRows(wb, utils, products) };
}

// Lê o .ods/.xlsx e devolve os produtos do catálogo que aparecem na lista.
// O casamento é pelo "Modelo / Identificador Decex" (nunca pela descrição, que
// é texto livre longo) contra o SKU do fabricante ou o SKU interno — o do
// fabricante tem prioridade, já que SKUs internos curtos, como "MC", podem
// coincidir com modelos de outros importadores. Primeiro vale a comparação
// exata (sem diferenciar maiúsculas/minúsculas); se não achar, tenta a
// aproximada (sem espaços/pontuação/acentos) e marca como "conferir".
export async function scanCpList(file: File, products: CpListProduct[]): Promise<CpListMatch[]> {
  const { read, utils } = await import("xlsx");
  const wb = read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
  return scanCpRows(wb, utils, products);
}

function scanCpRows(
  wb: import("xlsx").WorkBook,
  utils: typeof import("xlsx").utils,
  products: CpListProduct[],
): CpListMatch[] {
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("consolidada")) ?? wb.SheetNames[0];
  const rows = utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1 });

  const headerIdx = rows.findIndex((r) => norm(r[0]) === "ncm" && norm(r[4]).startsWith("modelo"));
  if (headerIdx < 0) {
    throw new Error(
      'Não reconheci a planilha. Formatos aceitos: lista pública do governo (NCM … "Modelo / Identificador Decex"), controle de LPCOs (LPCO, Produto, Situação, Registro, Deferimento, Validade, UF) ou a base de itens do Inciso V (Importador/Solicitante … Modelo).',
    );
  }

  const byModel = new Map<string, ListRow[]>();
  const byLooseModel = new Map<string, ListRow[]>();
  const byBaseModel = new Map<string, ListRow[]>(); // sem parênteses
  for (const r of rows.slice(headerIdx + 1)) {
    const model = norm(r[4]);
    if (!model) continue;
    const list = byModel.get(model) ?? [];
    list.push({ ncm: String(r[0] ?? "").trim(), nationalMaker: norm(r[5]) !== "", cp: cpText(r[6]) });
    byModel.set(model, list);
    const looseKey = loose(model);
    if (looseKey.length >= MIN_LOOSE_LENGTH) {
      const looseList = byLooseModel.get(looseKey) ?? [];
      looseList.push(list[list.length - 1]);
      byLooseModel.set(looseKey, looseList);
    }
    const baseKey = loose(withoutParens(model));
    if (baseKey.length >= MIN_LOOSE_LENGTH) {
      const baseList = byBaseModel.get(baseKey) ?? [];
      baseList.push(list[list.length - 1]);
      byBaseModel.set(baseKey, baseList);
    }
  }

  const matches: CpListMatch[] = [];
  for (const p of products) {
    const exactHits =
      (p.manufacturerSku ? byModel.get(norm(p.manufacturerSku)) : undefined) ?? byModel.get(norm(p.sku));
    const looseKeys = [p.manufacturerSku, p.sku].map(loose).filter((k) => k.length >= MIN_LOOSE_LENGTH);
    let approxHits = exactHits ? undefined : looseKeys.map((k) => byLooseModel.get(k)).find(Boolean);
    if (!exactHits && !approxHits) {
      // 3ª tentativa: sem a versão/região entre parênteses, pelo SKU, SKU do
      // fabricante ou nome — sempre "para conferir" (a variante pode mudar).
      const baseKeys = [p.manufacturerSku, p.sku, p.description]
        .map((v) => loose(withoutParens(v)))
        .filter((k) => k.length >= MIN_LOOSE_LENGTH);
      approxHits = baseKeys.map((k) => byBaseModel.get(k)).find(Boolean);
    }
    const hits = exactHits ?? approxHits;
    if (!hits) continue;
    const cps = [...new Set(hits.map((h) => h.cp).filter(Boolean))].sort((a, b) => cpSortKey(b).localeCompare(cpSortKey(a)));
    matches.push({
      productId: p.id,
      result: approxHits ? "FOUND_APPROX" : hits.some((h) => !h.nationalMaker) ? "FOUND" : "FOUND_NATIONAL",
      ref: cps.slice(0, 5).join(", "),
      ncm: hits[0].ncm || null,
    });
  }
  return matches;
}

// "..._21.10.2026.ods" -> "2026-10-21" (data de atualização que o governo
// embute no nome do arquivo); sem data no nome, null.
export function listDateFromFileName(name: string): string | null {
  const m = name.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
