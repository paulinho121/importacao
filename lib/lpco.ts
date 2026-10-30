// Controle de LPCO por produto e filial.

// Quantos dias um LPCO deferido pode ser reaproveitado, contados a partir da
// data de deferimento — individualmente em cada filial.
export const LPCO_REUSE_DAYS = 180;

export type ProductLpcoStatus = "NAO_SOLICITADO" | "EM_ANALISE" | "DEFERIDO" | "INDEFERIDO";

export const PRODUCT_LPCO_STATUSES: { value: ProductLpcoStatus; label: string }[] = [
  { value: "NAO_SOLICITADO", label: "Não solicitado" },
  { value: "EM_ANALISE", label: "Em análise" },
  { value: "DEFERIDO", label: "Deferido" },
  { value: "INDEFERIDO", label: "Indeferido" },
];

export function productLpcoStatusLabel(status: string): string {
  return PRODUCT_LPCO_STATUSES.find((s) => s.value === status)?.label ?? status;
}

// Data (yyyy-mm-dd) até a qual um LPCO deferido pode ser reutilizado.
export function lpcoValidUntil(approvedAt: string | null): string | null {
  if (!approvedAt) return null;
  const d = new Date(`${approvedAt}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + LPCO_REUSE_DAYS);
  return d.toISOString().slice(0, 10);
}

export type LpcoTone = "ok" | "wait" | "bad" | "expired" | "none";

// Situação para os indicadores visuais: deferido dentro do prazo (ok),
// deferido com prazo vencido (expired), em análise (wait), indeferido (bad).
export function lpcoTone(lpco: { status: string; approvedAt: string | null }, today = new Date()): LpcoTone {
  if (lpco.status === "DEFERIDO") {
    const until = lpcoValidUntil(lpco.approvedAt);
    if (until && new Date(`${until}T23:59:59Z`) < today) return "expired";
    return "ok";
  }
  if (lpco.status === "EM_ANALISE") return "wait";
  if (lpco.status === "INDEFERIDO") return "bad";
  return "none";
}

export const LPCO_TONE_CLASS: Record<LpcoTone, string> = {
  ok: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  wait: "bg-secondary-fixed text-on-secondary-fixed-variant",
  bad: "bg-error-container text-on-error-container",
  expired: "bg-warning/20 text-warning",
  none: "bg-surface-container-high text-on-surface-variant",
};
