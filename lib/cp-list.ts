// Varredura da lista pública do governo ("Relação dos resultados das
// apurações de produção nacional", art. 42 da Portaria Secex nº 249/2023)
// contra o catálogo de produtos. A planilha (.ods, ~9 MB) é lida no
// navegador de quem faz o upload — só o resultado da conferência (dezenas
// de linhas) vai pro servidor, em vez do arquivo inteiro.

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

export type CpListProduct = { id: string; sku: string; manufacturerSku: string | null };

export type CpListMatch = {
  productId: string;
  result: "FOUND" | "FOUND_NATIONAL" | "FOUND_APPROX";
  ref: string;
  ncm: string | null;
};

type ListRow = { ncm: string; nationalMaker: boolean; cp: string };

// Comparação exata: ignora maiúsculas/minúsculas e espaços sobrando.
const norm = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ").toLowerCase();

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
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("consolidada")) ?? wb.SheetNames[0];
  const rows = utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1 });

  const headerIdx = rows.findIndex((r) => norm(r[0]) === "ncm" && norm(r[4]).startsWith("modelo"));
  if (headerIdx < 0) {
    throw new Error(
      'Não achei o cabeçalho da lista (NCM … "Modelo / Identificador Decex"). Confira se é o arquivo "Relação dos resultados das apurações de produção nacional".',
    );
  }

  const byModel = new Map<string, ListRow[]>();
  const byLooseModel = new Map<string, ListRow[]>();
  for (const r of rows.slice(headerIdx + 1)) {
    const model = norm(r[4]);
    if (!model) continue;
    const list = byModel.get(model) ?? [];
    list.push({ ncm: String(r[0] ?? "").trim(), nationalMaker: norm(r[5]) !== "", cp: String(r[6] ?? "").trim() });
    byModel.set(model, list);
    const looseKey = loose(model);
    if (looseKey.length >= MIN_LOOSE_LENGTH) {
      const looseList = byLooseModel.get(looseKey) ?? [];
      looseList.push(list[list.length - 1]);
      byLooseModel.set(looseKey, looseList);
    }
  }

  const matches: CpListMatch[] = [];
  for (const p of products) {
    const exactHits =
      (p.manufacturerSku ? byModel.get(norm(p.manufacturerSku)) : undefined) ?? byModel.get(norm(p.sku));
    const looseKeys = [p.manufacturerSku, p.sku].map(loose).filter((k) => k.length >= MIN_LOOSE_LENGTH);
    const approxHits = exactHits ? undefined : looseKeys.map((k) => byLooseModel.get(k)).find(Boolean);
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
