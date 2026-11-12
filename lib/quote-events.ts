// Histórico das cotações (fornecedor e agente de cargas): tipos e utilitários
// puros, usados tanto nas ações do servidor quanto nos componentes.

export type QuoteEventType = "SUPPLIER" | "FREIGHT";

export type QuoteEventRow = {
  id: string;
  quoteType: QuoteEventType;
  quoteId: string;
  description: string;
  actor: string | null;
  createdAt: string; // ISO
};

// "2026-03-05" → "05/03/2026"
export const fmtDate = (d: string | null | undefined) => (d ? d.split("-").reverse().join("/") : "—");

export const fmtText = (v: string | null | undefined) => (v && v.trim() ? v.trim() : "—");

// "Rótulo: antes → depois", ou null quando não mudou.
export function changeLine(
  label: string,
  before: string | null | undefined,
  after: string | null | undefined,
): string | null {
  const b = (before ?? "").trim();
  const a = (after ?? "").trim();
  if (b === a) return null;
  return `${label}: ${b || "—"} → ${a || "—"}`;
}

// Para campos numéricos vindos do banco como "10.00" e do formulário como "10":
// compara pelo valor, não pelo texto.
export function sameNumber(a: string | number | null | undefined, b: string | number | null | undefined): boolean {
  const na = a === null || a === undefined || a === "" ? null : Number(a);
  const nb = b === null || b === undefined || b === "" ? null : Number(b);
  return na === nb;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}
