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
  | "EM_EXIGENCIA"
  | "DEFERIDA"
  | "CANCELADA_INDEFERIDA";

export const LICENSE_STATUS_LABEL: Record<LicenseStatus, string> = {
  A_REGISTRAR: "A Registrar",
  PARA_ANALISE: "Para Análise",
  EM_CONSULTA_PUBLICA: "Em Consulta Pública",
  EM_EXIGENCIA: "Em Exigência",
  DEFERIDA: "Deferida",
  CANCELADA_INDEFERIDA: "Cancelada / Indeferida",
};

export const LICENSE_STATUS_BADGE_CLASS: Record<LicenseStatus, string> = {
  A_REGISTRAR: "bg-surface-container-high text-on-surface-variant",
  PARA_ANALISE: "bg-secondary-fixed text-on-secondary-fixed-variant",
  EM_CONSULTA_PUBLICA: "bg-secondary-fixed text-on-secondary-fixed-variant",
  EM_EXIGENCIA: "bg-error-container text-on-error-container",
  DEFERIDA: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  CANCELADA_INDEFERIDA: "bg-error-container text-on-error-container",
};

// Canal de parametrização da declaração de importação (DUIMP/DI).
export type CustomsChannel = "VERDE" | "AMARELO" | "VERMELHO" | "CINZA";

export const CUSTOMS_CHANNEL_LABEL: Record<CustomsChannel, string> = {
  VERDE: "Verde",
  AMARELO: "Amarelo",
  VERMELHO: "Vermelho",
  CINZA: "Cinza",
};

export const CUSTOMS_CHANNEL_BADGE_CLASS: Record<CustomsChannel, string> = {
  VERDE: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  AMARELO: "bg-warning/10 text-warning",
  VERMELHO: "bg-error-container text-on-error-container",
  CINZA: "bg-surface-container-high text-on-surface-variant",
};

// Ciclo de vida do Pedido de Compra — ver purchase_orders.
export type PurchaseOrderStatus = "RASCUNHO" | "ENVIADO" | "CONFIRMADO" | "CANCELADO";

export const PURCHASE_ORDER_STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  RASCUNHO: "Rascunho",
  ENVIADO: "Enviado",
  CONFIRMADO: "Confirmado",
  CANCELADO: "Cancelado",
};

export const PURCHASE_ORDER_STATUS_BADGE_CLASS: Record<PurchaseOrderStatus, string> = {
  RASCUNHO: "bg-surface-container-high text-on-surface-variant",
  ENVIADO: "bg-secondary-fixed text-on-secondary-fixed-variant",
  CONFIRMADO: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  CANCELADO: "bg-error-container text-on-error-container",
};

// Status do controle externo de itens já em importação — ver
// external_import_items. Vocabulário livre migrado da planilha que o
// usuário mantinha por fora do sistema.
export type ExternalImportItemStatus =
  | "EM_NEGOCIACAO"
  | "AGUARDANDO_EMBARQUE"
  | "EM_DESEMBARACO"
  | "CONCLUIDO"
  | "CONSOLIDADO_EM_OUTRO_PROCESSO"
  | "CANCELADO";

export const EXTERNAL_IMPORT_ITEM_STATUS_LABEL: Record<ExternalImportItemStatus, string> = {
  EM_NEGOCIACAO: "Em Negociação",
  AGUARDANDO_EMBARQUE: "Aguardando Embarque",
  EM_DESEMBARACO: "Em Desembaraço",
  CONCLUIDO: "Concluído",
  CONSOLIDADO_EM_OUTRO_PROCESSO: "Consolidado em Outro Processo",
  CANCELADO: "Cancelado",
};

export const EXTERNAL_IMPORT_ITEM_STATUS_BADGE_CLASS: Record<ExternalImportItemStatus, string> = {
  EM_NEGOCIACAO: "bg-surface-container-high text-on-surface-variant",
  AGUARDANDO_EMBARQUE: "bg-warning/10 text-warning",
  EM_DESEMBARACO: "bg-secondary-fixed text-on-secondary-fixed-variant",
  CONCLUIDO: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  CONSOLIDADO_EM_OUTRO_PROCESSO: "bg-surface-container-high text-on-surface-variant",
  CANCELADO: "bg-error-container text-on-error-container",
};

// Categoria de conta a pagar — ver process_payables.
export type PayableCategory =
  | "FORNECEDOR"
  | "FRETE"
  | "SEGURO"
  | "DESEMBARACO"
  | "ARMAZENAGEM"
  | "IMPOSTO"
  | "OUTRO";

export const PAYABLE_CATEGORY_LABEL: Record<PayableCategory, string> = {
  FORNECEDOR: "Fornecedor",
  FRETE: "Frete",
  SEGURO: "Seguro",
  DESEMBARACO: "Desembaraço",
  ARMAZENAGEM: "Armazenagem",
  IMPOSTO: "Imposto",
  OUTRO: "Outro",
};

// Órgãos anuentes que exigem LPCO — ver process_lpcos.
export type LpcoAgency =
  | "ANVISA"
  | "MAPA"
  | "INMETRO"
  | "IBAMA"
  | "EXERCITO"
  | "ANP"
  | "DECEX"
  | "OUTRO";

export const LPCO_AGENCY_LABEL: Record<LpcoAgency, string> = {
  ANVISA: "Anvisa",
  MAPA: "MAPA",
  INMETRO: "Inmetro",
  IBAMA: "Ibama",
  EXERCITO: "Exército/DFPC",
  ANP: "ANP",
  DECEX: "Decex",
  OUTRO: "Outro",
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
