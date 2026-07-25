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

// Regra de negócio: qual status resulta de estar em cada etapa do fluxo.
// ATRASADO fica fora dessa progressão — é uma correção manual (ver
// updateProcessStatus), não uma etapa alcançada ao avançar.
export const STATUS_BY_STEP: Record<number, ProcessStatus> = {
  1: "AGUARDANDO_EMBARQUE",
  2: "AGUARDANDO_EMBARQUE",
  3: "AGUARDANDO_EMBARQUE",
  4: "EMBARCADO",
  5: "EM_TRANSITO",
  6: "EM_DESEMBARACO",
  7: "CONCLUIDO",
};

// Datas de processo (etd/eta) são valores de calendário puros (sem hora),
// vindos de uma coluna `date` do Postgres. new Date("YYYY-MM-DD") interpreta
// isso como meia-noite UTC — se formatarmos/comparamos em horário local
// (ex: UTC-3), o dia exibido fica um dia atrás do valor real no banco.
// Por isso todo o cálculo abaixo é feito em UTC, do início ao fim.
export function diasRestantes(etaEstimated: string | null): number | null {
  if (!etaEstimated) return null;
  const eta = new Date(`${etaEstimated}T00:00:00Z`).getTime();
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((eta - todayUtc) / 86_400_000);
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00Z`);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
