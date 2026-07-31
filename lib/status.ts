export type ProcessStatus =
  | "AGUARDANDO_EMBARQUE"
  | "PEDIDO"
  | "PRODUCAO"
  | "EMBARCADO"
  | "EM_TRANSITO"
  | "EM_DESEMBARACO"
  | "TRANSPORTE_NACIONAL"
  | "RECEBIDO"
  | "ATRASADO"
  | "CONCLUIDO";

// Rótulos seguem a nomenclatura vista em "FLUXOGRAMA DE IMPORTAÇÃO.xlsx"
// (aba TABELA AUXILIAR) — por isso EMBARCADO exibe "Embarque" e CONCLUIDO
// exibe "Finalizado", sem precisar renomear o valor do enum no banco.
export const STATUS_LABEL: Record<ProcessStatus, string> = {
  AGUARDANDO_EMBARQUE: "Aguardando Embarque",
  PEDIDO: "Pedido",
  PRODUCAO: "Produção",
  EMBARCADO: "Embarque",
  EM_TRANSITO: "Em Trânsito",
  EM_DESEMBARACO: "Em Desembaraço",
  TRANSPORTE_NACIONAL: "Transporte Nacional",
  RECEBIDO: "Recebido",
  ATRASADO: "Atrasado",
  CONCLUIDO: "Finalizado",
};

export const STATUS_BADGE_CLASS: Record<ProcessStatus, string> = {
  AGUARDANDO_EMBARQUE: "bg-surface-container-high text-on-surface-variant",
  PEDIDO: "bg-surface-container-high text-on-surface-variant",
  PRODUCAO: "bg-surface-container-high text-on-surface-variant",
  EMBARCADO: "bg-secondary-fixed text-on-secondary-fixed-variant",
  EM_TRANSITO: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  EM_DESEMBARACO: "bg-secondary-fixed text-on-secondary-fixed-variant",
  TRANSPORTE_NACIONAL: "bg-secondary-fixed text-on-secondary-fixed-variant",
  RECEBIDO: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  ATRASADO: "bg-error-container text-on-error-container",
  CONCLUIDO: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
};

export const STATUS_ICON: Record<ProcessStatus, string> = {
  AGUARDANDO_EMBARQUE: "schedule",
  PEDIDO: "receipt_long",
  PRODUCAO: "precision_manufacturing",
  EMBARCADO: "flight_takeoff",
  EM_TRANSITO: "local_shipping",
  EM_DESEMBARACO: "gavel",
  TRANSPORTE_NACIONAL: "local_shipping",
  RECEBIDO: "inventory_2",
  ATRASADO: "warning",
  CONCLUIDO: "check_circle",
};

// 8 etapas — alinhado ao pipeline visto na planilha (TABELA AUXILIAR):
// Pedido, Produção, Embarque, Em Trânsito, Desembaraço, Transporte,
// Recebido, + Finalizado. "Finalizado" (CONCLUIDO) não é uma etapa do
// stepper — só se atinge via o select manual de status, igual "Atrasado".
export const WORKFLOW_STEPS = [
  "Cotação",
  "Pedido",
  "Produção",
  "Embarque",
  "Em Trânsito",
  "Desembaraço",
  "Transporte Nacional",
  "Recebido",
] as const;

// Regra de negócio: qual status resulta de estar em cada etapa do fluxo.
// ATRASADO/CONCLUIDO ficam fora dessa progressão — são correção/fechamento
// manual (ver updateProcessStatus), não etapas alcançadas ao avançar.
export const STATUS_BY_STEP: Record<number, ProcessStatus> = {
  1: "AGUARDANDO_EMBARQUE",
  2: "PEDIDO",
  3: "PRODUCAO",
  4: "EMBARCADO",
  5: "EM_TRANSITO",
  6: "EM_DESEMBARACO",
  7: "TRANSPORTE_NACIONAL",
  8: "RECEBIDO",
};

// Status de licenciamento de importação ("Inciso V") — ver products.licenseStatus.
export type LicenseStatus =
  | "A_REGISTRAR"
  | "PARA_ANALISE"
  | "EM_CONSULTA_PUBLICA"
  | "DEFERIDA"
  | "CANCELADA_INDEFERIDA";

export const LICENSE_STATUS_LABEL: Record<LicenseStatus, string> = {
  A_REGISTRAR: "A Registrar",
  PARA_ANALISE: "Para Análise",
  EM_CONSULTA_PUBLICA: "Em Consulta Pública",
  DEFERIDA: "Deferida",
  CANCELADA_INDEFERIDA: "Cancelada / Indeferida",
};

export const LICENSE_STATUS_BADGE_CLASS: Record<LicenseStatus, string> = {
  A_REGISTRAR: "bg-surface-container-high text-on-surface-variant",
  PARA_ANALISE: "bg-secondary-fixed text-on-secondary-fixed-variant",
  EM_CONSULTA_PUBLICA: "bg-secondary-fixed text-on-secondary-fixed-variant",
  DEFERIDA: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  CANCELADA_INDEFERIDA: "bg-error-container text-on-error-container",
};

// Status visual de estoque por item (planilha: 🟢 Disponível / 🟡 Últimas
// Unidades / 🔴 Esgotado). A planilha não define o limiar exato de
// "últimas unidades" — assumo <=20% do pedido, documentado aqui.
export function stockStatus(available: number, total: number): {
  label: string;
  className: string;
} {
  if (available <= 0) {
    return { label: "🔴 Esgotado", className: "bg-error-container text-on-error-container" };
  }
  if (total > 0 && available / total <= 0.2) {
    return {
      label: "🟡 Últimas Unidades",
      className: "bg-secondary-fixed text-on-secondary-fixed-variant",
    };
  }
  return {
    label: "🟢 Disponível",
    className: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  };
}

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
