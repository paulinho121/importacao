// Planilha de controle de LPCOs da MCI ("Controle de LPCOS - MCI", .xlsx):
// colunas LPCO, Produto, Situação, Registro, Deferimento, Validade e UF —
// podendo ter vários blocos lado a lado (cada um com seu cabeçalho). Cada
// linha vira uma solicitação de LPCO do produto no estado (UF) indicado.

import type { ProductLpcoStatus } from "@/lib/lpco";

export type LpcoSheetRecord = {
  productName: string;
  lpcoNumber: string | null;
  status: ProductLpcoStatus;
  requestedAt: string | null;
  approvedAt: string | null;
  validUntil: string | null;
  branch: string; // SP | SC | CE
  notes: string | null;
};

export type LpcoSheetProduct = {
  id: string;
  sku: string;
  manufacturerSku: string | null;
  description: string;
};

export type LpcoSheetImport = {
  records: (Omit<LpcoSheetRecord, "productName"> & { productId: string })[];
  unmatched: string[]; // nomes de produto que não achei no catálogo
  ambiguous: string[]; // nomes que casam com mais de um produto
  skipped: number; // linhas sem UF válida
};

const key = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Excel guarda data como número de dias desde 30/12/1899.
function toIsoDate(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    return new Date(Math.round((v - 25569) * 86_400_000)).toISOString().slice(0, 10);
  }
  const text = String(v ?? "").trim();
  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

// "Deferida" -> DEFERIDO; "Em exigência - CP", "Ag. deferimento" -> EM_ANALISE
// (o texto original vai pra observação); "Indeferida" -> INDEFERIDO.
function mapStatus(text: string): { status: ProductLpcoStatus; note: string | null } {
  const t = key(text);
  if (t.startsWith("indefer")) return { status: "INDEFERIDO", note: null };
  if (t.startsWith("defer")) return { status: "DEFERIDO", note: null };
  return { status: "EM_ANALISE", note: text.trim() || null };
}

const BRANCHES = ["SP", "SC", "CE"];

// Acha os cabeçalhos "LPCO" + "Produto" e lê cada bloco abaixo dele.
export function parseLpcoSheet(rows: unknown[][]): LpcoSheetRecord[] {
  const out: LpcoSheetRecord[] = [];
  for (let h = 0; h < rows.length; h++) {
    const header = rows[h].map(key);
    const starts = header.flatMap((cell, c) => (cell === "lpco" && header[c + 1] === "produto" ? [c] : []));
    if (starts.length === 0) continue;

    for (const start of starts) {
      const col = (name: string) => {
        const idx = header.slice(start, start + 8).indexOf(name);
        return idx < 0 ? -1 : start + idx;
      };
      const cols = {
        lpco: start,
        produto: start + 1,
        situacao: col("situacao"),
        registro: col("registro"),
        deferimento: col("deferimento"),
        validade: col("validade"),
        uf: col("uf"),
      };
      for (const r of rows.slice(h + 1)) {
        const productName = String(r[cols.produto] ?? "").trim();
        if (!productName) continue;
        const { status, note } = mapStatus(String(cols.situacao >= 0 ? (r[cols.situacao] ?? "") : ""));
        out.push({
          productName,
          lpcoNumber: String(r[cols.lpco] ?? "").trim() || null,
          status,
          requestedAt: cols.registro >= 0 ? toIsoDate(r[cols.registro]) : null,
          approvedAt: cols.deferimento >= 0 ? toIsoDate(r[cols.deferimento]) : null,
          validUntil: cols.validade >= 0 ? toIsoDate(r[cols.validade]) : null,
          branch: cols.uf >= 0 ? String(r[cols.uf] ?? "").trim().toUpperCase() : "",
          notes: note,
        });
      }
    }
    break; // só o primeiro cabeçalho: os blocos lado a lado já foram lidos
  }
  return out;
}

// Casa o nome do "Produto" com o SKU do fabricante, o SKU interno ou o nome
// do produto (sem diferenciar maiúsculas, espaços, pontuação e acentos).
export function matchLpcoSheet(records: LpcoSheetRecord[], products: LpcoSheetProduct[]): LpcoSheetImport {
  const index = new Map<string, Set<string>>();
  for (const p of products) {
    for (const value of [p.manufacturerSku, p.sku, p.description]) {
      const k = key(value);
      if (k.length < 3) continue;
      const set = index.get(k) ?? new Set<string>();
      set.add(p.id);
      index.set(k, set);
    }
  }

  const result: LpcoSheetImport = { records: [], unmatched: [], ambiguous: [], skipped: 0 };
  const unmatched = new Set<string>();
  const ambiguous = new Set<string>();
  for (const r of records) {
    if (!BRANCHES.includes(r.branch)) {
      result.skipped++;
      continue;
    }
    const ids = index.get(key(r.productName));
    if (!ids) {
      unmatched.add(r.productName);
      continue;
    }
    if (ids.size > 1) {
      ambiguous.add(r.productName);
      continue;
    }
    const { productName: _name, ...rest } = r;
    void _name;
    result.records.push({ ...rest, productId: [...ids][0] });
  }
  result.unmatched = [...unmatched].sort((a, b) => a.localeCompare(b));
  result.ambiguous = [...ambiguous].sort((a, b) => a.localeCompare(b));
  return result;
}
