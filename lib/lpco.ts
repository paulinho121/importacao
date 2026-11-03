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
export function lpcoValidUntil(approvedAt: string | null, validUntil?: string | null): string | null {
  if (validUntil) return validUntil;
  if (!approvedAt) return null;
  const d = new Date(`${approvedAt}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + LPCO_REUSE_DAYS);
  return d.toISOString().slice(0, 10);
}

export type LpcoTone = "ok" | "wait" | "bad" | "expired" | "none";

// Situação para os indicadores visuais: deferido dentro do prazo (ok),
// deferido com prazo vencido (expired), em análise (wait), indeferido (bad).
export function lpcoTone(
  lpco: { status: string; approvedAt: string | null; validUntil?: string | null },
  today = new Date(),
): LpcoTone {
  if (lpco.status === "DEFERIDO") {
    const until = lpcoValidUntil(lpco.approvedAt, lpco.validUntil);
    if (until && new Date(`${until}T23:59:59Z`) < today) return "expired";
    return "ok";
  }
  if (lpco.status === "EM_ANALISE") return "wait";
  if (lpco.status === "INDEFERIDO") return "bad";
  return "none";
}

export const LPCO_TONE_CLASS: Record<LpcoTone, string> = {
  ok: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  wait: "bg-surface-container-high text-on-surface-variant",
  bad: "bg-error-container text-on-error-container",
  expired: "bg-warning/20 text-warning",
  none: "bg-surface-container-high text-on-surface-variant",
};

export type LpcoCountdown = {
  total: number; // duração do benefício (LPCO_REUSE_DAYS)
  daysLeft: number; // negativo = vencido há N dias
  expired: boolean;
  pctLeft: number; // 0-100, pra barra de progresso
  level: "ok" | "warn" | "danger";
};

// Contagem do tempo que falta de um LPCO deferido: dias restantes dos
// LPCO_REUSE_DAYS contados a partir da data de deferimento. Amarelo quando
// faltam 60 dias ou menos e vermelho com 30 ou menos (ou vencido).
export function lpcoCountdown(
  approvedAt: string | null,
  today = new Date(),
  validUntil?: string | null,
): LpcoCountdown | null {
  const until = lpcoValidUntil(approvedAt, validUntil);
  if (!until) return null;
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(`${until}T00:00:00Z`).getTime();
  const daysLeft = Math.round((end - todayUtc) / 86_400_000);
  // Duração total: da data de deferimento até a validade (180 dias, ou o que
  // a validade informada indicar).
  const total =
    validUntil && approvedAt
      ? Math.max(1, Math.round((end - new Date(`${approvedAt}T00:00:00Z`).getTime()) / 86_400_000))
      : LPCO_REUSE_DAYS;
  const pctLeft = Math.max(0, Math.min(100, (daysLeft / total) * 100));
  return {
    total,
    daysLeft,
    expired: daysLeft < 0,
    pctLeft,
    level: daysLeft <= 30 ? "danger" : daysLeft <= 60 ? "warn" : "ok",
  };
}

export const LPCO_COUNTDOWN_BAR: Record<LpcoCountdown["level"], string> = {
  ok: "bg-secondary",
  warn: "bg-warning",
  danger: "bg-error",
};
