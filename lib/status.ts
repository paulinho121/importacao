export type ProcessStatus =
  | "AGUARDANDO_EMBARQUE"
  | "EMBARCADO"
  | "EM_TRANSITO"
  | "EM_DESEMBARACO"
  | "ATRASADO"
  | "CONCLUIDO";

export const STATUS_LABEL: Record<ProcessStatus, string> = {
  AGUARDANDO_EMBARQUE: "Aguardando Embarque",
  EMBARCADO: "Embarcado",
  EM_TRANSITO: "Em Trânsito",
  EM_DESEMBARACO: "Em Desembaraço",
  ATRASADO: "Atrasado",
  CONCLUIDO: "Concluído",
};

export const STATUS_BADGE_CLASS: Record<ProcessStatus, string> = {
  AGUARDANDO_EMBARQUE: "bg-surface-container-high text-on-surface-variant",
  EMBARCADO: "bg-secondary-fixed text-on-secondary-fixed-variant",
  EM_TRANSITO: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  EM_DESEMBARACO: "bg-secondary-fixed text-on-secondary-fixed-variant",
  ATRASADO: "bg-error-container text-on-error-container",
  CONCLUIDO: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
};

export const STATUS_ICON: Record<ProcessStatus, string> = {
  AGUARDANDO_EMBARQUE: "schedule",
  EMBARCADO: "flight_takeoff",
  EM_TRANSITO: "local_shipping",
  EM_DESEMBARACO: "gavel",
  ATRASADO: "warning",
  CONCLUIDO: "check_circle",
};

export const WORKFLOW_STEPS = [
  "Cotação",
  "Pedido",
  "Produção",
  "Embarcado",
  "Em Trânsito",
  "Desembaraço",
  "Entregue",
] as const;

export function diasRestantes(etaEstimated: string | null): number | null {
  if (!etaEstimated) return null;
  const eta = new Date(etaEstimated);
  const today = new Date();
  eta.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((eta.getTime() - today.getTime()) / 86_400_000);
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
