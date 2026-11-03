// Base de dados dos itens amparados pelo benefício do Inciso V ("BD Itens
// Amparados Inciso V", .xlsx): uma linha por licença, com importador, Nº da
// licença, data de registro, fabricante, exportador, modelo, NCMs, descrição
// detalhada, consulta pública, deferimento, status e ref. do despachante.
// O "Modelo" identifica o produto (SKU do fabricante / nome no catálogo).

export type IncisoRecord = {
  model: string;
  manufacturerName: string | null;
  exporterName: string | null;
  ncmAnterior: string | null;
  ncm: string | null;
  longDescription: string | null;
  publicConsultationRef: string | null;
  licenseNumber: string | null;
  licenseRegisteredAt: string | null;
  licenseApprovedAt: string | null;
  licenseStatus: string | null; // valores de licenseStatusEnum
  customsBrokerRef: string | null;
};

export type IncisoProduct = { id: string; sku: string; manufacturerSku: string | null; description: string };

export type IncisoImport = {
  matched: { productId: string; record: IncisoRecord }[];
  unmatched: IncisoRecord[];
  ambiguous: string[];
};

const key = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const text = (v: unknown) => String(v ?? "").trim() || null;

function toIsoDate(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 20000) {
    return new Date(Math.round((v - 25569) * 86_400_000)).toISOString().slice(0, 10);
  }
  const t = String(v ?? "").trim();
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) return `${br[3].length === 2 ? `20${br[3]}` : br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

// "94059900" (número) ou "9405.99.00" -> "9405.99.00"; "XXXXXXXX" e vazio -> null.
function toNcm(v: unknown): string | null {
  const digits = String(v ?? "").replace(/\D/g, "");
  if (digits.length !== 8) return null;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
}

// A planilha mistura "Deferida/Deferido", "Indeferida/Cancelada" etc.
function toLicenseStatus(v: unknown): string | null {
  const t = key(v);
  if (!t) return null;
  if (t.startsWith("indefer") || t.startsWith("cancel")) return "CANCELADA_INDEFERIDA";
  if (t.startsWith("defer")) return "DEFERIDA";
  if (t.includes("exigencia")) return "EM_EXIGENCIA";
  if (t.includes("consultapublica")) return "EM_CONSULTA_PUBLICA";
  if (t.includes("analise")) return "PARA_ANALISE";
  if (t.includes("registrar")) return "A_REGISTRAR";
  return null;
}

// Ref. do despachante vem às vezes como "#REF!" (fórmula quebrada na planilha).
function toBrokerRef(v: unknown): string | null {
  const t = text(v);
  return t && !t.startsWith("#") ? t : null;
}

// Lê o cabeçalho ("Importador/Solicitante … Modelo …") e devolve uma linha por
// modelo — a licença mais recente (data de registro) quando há várias.
export function parseIncisoSheet(rows: unknown[][]): IncisoRecord[] {
  const h = rows.findIndex((r) => key(r[0]).startsWith("importador") && r.some((c) => key(c) === "modelo"));
  if (h < 0) return [];
  const head = rows[h].map(key);
  const col = (name: string) => head.indexOf(key(name));
  const c = {
    license: col("Licença No."),
    registered: col("Data Registro"),
    maker: col("Fabricante"),
    exporter: col("Exportador"),
    model: col("Modelo"),
    ncmOld: col("NCM ANTERIOR"),
    ncm: col("NCM VIGENTE"),
    desc: col("Descrição detalhada"),
    cp: col("Consulta Pública"),
    approved: col("Data Deferimento"),
    status: col("Status"),
    broker: col("Ref. Despachante"),
  };
  const get = (r: unknown[], i: number) => (i >= 0 ? r[i] : "");

  const latest = new Map<string, IncisoRecord>();
  for (const r of rows.slice(h + 1)) {
    const model = text(get(r, c.model));
    if (!model) continue;
    const record: IncisoRecord = {
      model,
      manufacturerName: text(get(r, c.maker)),
      exporterName: text(get(r, c.exporter)),
      ncmAnterior: toNcm(get(r, c.ncmOld)),
      ncm: toNcm(get(r, c.ncm)),
      longDescription: text(get(r, c.desc)),
      publicConsultationRef: text(get(r, c.cp)),
      licenseNumber: text(get(r, c.license)),
      licenseRegisteredAt: toIsoDate(get(r, c.registered)),
      licenseApprovedAt: toIsoDate(get(r, c.approved)),
      licenseStatus: toLicenseStatus(get(r, c.status)),
      customsBrokerRef: toBrokerRef(get(r, c.broker)),
    };
    const k = key(model);
    const cur = latest.get(k);
    if (!cur || (record.licenseRegisteredAt ?? "") >= (cur.licenseRegisteredAt ?? "")) latest.set(k, record);
  }
  return [...latest.values()];
}

// Casa o "Modelo" com o SKU do fabricante, o SKU interno ou o nome.
export function matchIncisoBase(records: IncisoRecord[], products: IncisoProduct[]): IncisoImport {
  const index = new Map<string, Set<string>>();
  for (const p of products) {
    for (const v of [p.manufacturerSku, p.sku, p.description]) {
      const k = key(v);
      if (k.length < 3) continue;
      const set = index.get(k) ?? new Set<string>();
      set.add(p.id);
      index.set(k, set);
    }
  }
  const out: IncisoImport = { matched: [], unmatched: [], ambiguous: [] };
  for (const record of records) {
    const ids = index.get(key(record.model));
    if (!ids) out.unmatched.push(record);
    else if (ids.size > 1) out.ambiguous.push(record.model);
    else out.matched.push({ productId: [...ids][0], record });
  }
  return out;
}
