export type ProcessStatus =
  | "PEDIDO"
  | "AGUARDANDO_APROVACAO"
  | "PEDIDO_CONFIRMADO"
  | "AGUARDANDO_PRODUCAO"
  | "PRODUCAO"
  | "PRODUCAO_CONCLUIDA"
  | "AGUARDANDO_COLETA_ORIGEM"
  | "COLETADO_ORIGEM"
  | "AGUARDANDO_EMBARQUE"
  | "EMBARCADO"
  | "EM_TRANSITO"
  | "AGUARDANDO_PRESENCA_CARGA"
  | "PRESENCA_CARGA"
  | "CARGA_REGISTRADA"
  | "EM_ANALISE_ADUANEIRA"
  | "EM_EXIGENCIA"
  | "EM_DESEMBARACO"
  | "AGUARDANDO_LIBERACAO_TERMINAL"
  | "AGUARDANDO_RETIRADA"
  | "TRANSPORTE_NACIONAL"
  | "RECEBIDO"
  | "EM_CONFERENCIA"
  | "EM_ESTOQUE"
  | "CONCLUIDO"
  | "ABANDONADO"
  | "ATRASADO"; // legado: não é mais uma etapa (ver lib/eta-delay.ts), só existe no enum do banco

// Sequência do processo de importação (24 etapas), da negociação ao encerramento.
// Os códigos antigos do banco foram mantidos quando o sentido é o mesmo:
// CARGA_REGISTRADA = "DUIMP Registrada", EM_DESEMBARACO = "Desembaraçado",
// TRANSPORTE_NACIONAL = "Em Trânsito Nacional", RECEBIDO = "Recebido no Armazém",
// CONCLUIDO = "Finalizado". ATRASADO deixou de ser etapa: é indicador automático
// pela ETA. Processos encerrados saem do fluxo e vão para /finalizados.
export const CLOSED_PROCESS_STATUSES = ["CONCLUIDO", "ABANDONADO"] as const;

// A ordem das chaves é a ordem em que o select de status aparece na tela.
export const STATUS_LABEL: Record<ProcessStatus, string> = {
  PEDIDO: "Pedido / Negociação",
  AGUARDANDO_APROVACAO: "Aguardando Aprovação",
  PEDIDO_CONFIRMADO: "Pedido Confirmado",
  AGUARDANDO_PRODUCAO: "Aguardando Produção",
  PRODUCAO: "Produção",
  PRODUCAO_CONCLUIDA: "Produção Concluída",
  AGUARDANDO_COLETA_ORIGEM: "Aguardando Coleta na Origem",
  COLETADO_ORIGEM: "Coletado na Origem",
  AGUARDANDO_EMBARQUE: "Aguardando Embarque",
  EMBARCADO: "Embarcado",
  EM_TRANSITO: "Em Trânsito Internacional",
  AGUARDANDO_PRESENCA_CARGA: "Aguardando Presença de Carga",
  PRESENCA_CARGA: "Presença de Carga",
  CARGA_REGISTRADA: "DUIMP Registrada",
  EM_ANALISE_ADUANEIRA: "Em Análise Aduaneira",
  EM_EXIGENCIA: "Em Exigência",
  EM_DESEMBARACO: "Desembaraçado",
  AGUARDANDO_LIBERACAO_TERMINAL: "Aguardando Liberação do Terminal",
  AGUARDANDO_RETIRADA: "Aguardando Retirada",
  TRANSPORTE_NACIONAL: "Em Trânsito Nacional",
  RECEBIDO: "Recebido no Armazém",
  EM_CONFERENCIA: "Em Conferência",
  EM_ESTOQUE: "Em Estoque",
  CONCLUIDO: "Finalizado",
  ABANDONADO: "Abandonado",
  ATRASADO: "Atrasado",
};

const NEUTRAL = "bg-surface-container-high text-on-surface-variant";
const ACTION = "bg-secondary-fixed text-on-secondary-fixed-variant";
const GOOD = "bg-tertiary-fixed text-on-tertiary-fixed-variant";
const BAD = "bg-error-container text-on-error-container";

export const STATUS_BADGE_CLASS: Record<ProcessStatus, string> = {
  PEDIDO: NEUTRAL,
  AGUARDANDO_APROVACAO: NEUTRAL,
  PEDIDO_CONFIRMADO: ACTION,
  AGUARDANDO_PRODUCAO: NEUTRAL,
  PRODUCAO: ACTION,
  PRODUCAO_CONCLUIDA: ACTION,
  AGUARDANDO_COLETA_ORIGEM: NEUTRAL,
  COLETADO_ORIGEM: ACTION,
  AGUARDANDO_EMBARQUE: NEUTRAL,
  EMBARCADO: ACTION,
  EM_TRANSITO: GOOD,
  AGUARDANDO_PRESENCA_CARGA: NEUTRAL,
  PRESENCA_CARGA: ACTION,
  CARGA_REGISTRADA: ACTION,
  EM_ANALISE_ADUANEIRA: ACTION,
  EM_EXIGENCIA: "bg-warning/20 text-warning",
  EM_DESEMBARACO: ACTION,
  AGUARDANDO_LIBERACAO_TERMINAL: NEUTRAL,
  AGUARDANDO_RETIRADA: NEUTRAL,
  TRANSPORTE_NACIONAL: GOOD,
  RECEBIDO: ACTION,
  EM_CONFERENCIA: ACTION,
  EM_ESTOQUE: GOOD,
  CONCLUIDO: GOOD,
  // vermelho neutro: "isso não vingou", não é urgência
  ABANDONADO: BAD,
  ATRASADO: BAD,
};

export const STATUS_ICON: Record<ProcessStatus, string> = {
  PEDIDO: "receipt_long",
  AGUARDANDO_APROVACAO: "hourglass_top",
  PEDIDO_CONFIRMADO: "verified",
  AGUARDANDO_PRODUCAO: "schedule",
  PRODUCAO: "precision_manufacturing",
  PRODUCAO_CONCLUIDA: "task_alt",
  AGUARDANDO_COLETA_ORIGEM: "schedule",
  COLETADO_ORIGEM: "inventory",
  AGUARDANDO_EMBARQUE: "schedule",
  EMBARCADO: "flight_takeoff",
  EM_TRANSITO: "local_shipping",
  AGUARDANDO_PRESENCA_CARGA: "hourglass_top",
  PRESENCA_CARGA: "how_to_reg",
  CARGA_REGISTRADA: "assignment_turned_in",
  EM_ANALISE_ADUANEIRA: "manage_search",
  EM_EXIGENCIA: "report",
  EM_DESEMBARACO: "gavel",
  AGUARDANDO_LIBERACAO_TERMINAL: "anchor",
  AGUARDANDO_RETIRADA: "schedule",
  TRANSPORTE_NACIONAL: "local_shipping",
  RECEBIDO: "warehouse",
  EM_CONFERENCIA: "fact_check",
  EM_ESTOQUE: "inventory_2",
  CONCLUIDO: "check_circle",
  ABANDONADO: "cancel",
  ATRASADO: "warning",
};

// As 24 etapas, em ordem. "Finalizado" é a última (encerra o processo).
export const WORKFLOW_STEPS = [
  "Pedido / Negociação",
  "Aguardando Aprovação",
  "Pedido Confirmado",
  "Aguardando Produção",
  "Produção",
  "Produção Concluída",
  "Aguardando Coleta na Origem",
  "Coletado na Origem",
  "Aguardando Embarque",
  "Embarcado",
  "Em Trânsito Internacional",
  "Aguardando Presença de Carga",
  "Presença de Carga",
  "DUIMP Registrada",
  "Em Análise Aduaneira",
  "Em Exigência",
  "Desembaraçado",
  "Aguardando Liberação do Terminal",
  "Aguardando Retirada",
  "Em Trânsito Nacional",
  "Recebido no Armazém",
  "Em Conferência",
  "Em Estoque",
  "Finalizado",
] as const;

// Qual status resulta de estar em cada etapa.
export const STATUS_BY_STEP: Record<number, ProcessStatus> = {
  1: "PEDIDO",
  2: "AGUARDANDO_APROVACAO",
  3: "PEDIDO_CONFIRMADO",
  4: "AGUARDANDO_PRODUCAO",
  5: "PRODUCAO",
  6: "PRODUCAO_CONCLUIDA",
  7: "AGUARDANDO_COLETA_ORIGEM",
  8: "COLETADO_ORIGEM",
  9: "AGUARDANDO_EMBARQUE",
  10: "EMBARCADO",
  11: "EM_TRANSITO",
  12: "AGUARDANDO_PRESENCA_CARGA",
  13: "PRESENCA_CARGA",
  14: "CARGA_REGISTRADA",
  15: "EM_ANALISE_ADUANEIRA",
  16: "EM_EXIGENCIA",
  17: "EM_DESEMBARACO",
  18: "AGUARDANDO_LIBERACAO_TERMINAL",
  19: "AGUARDANDO_RETIRADA",
  20: "TRANSPORTE_NACIONAL",
  21: "RECEBIDO",
  22: "EM_CONFERENCIA",
  23: "EM_ESTOQUE",
  24: "CONCLUIDO",
};

// Opções do select de status: a sequência + Abandonado (encerramento manual).
// Atrasado não aparece: é automático.
export const PROCESS_STATUS_OPTIONS: ProcessStatus[] = [
  ...(Object.values(STATUS_BY_STEP) as ProcessStatus[]),
  "ABANDONADO",
];

// Etapa (1..24) de um status da sequência; null para Abandonado/Atrasado.
export function stepOfStatus(status: string): number | null {
  const entry = Object.entries(STATUS_BY_STEP).find(([, st]) => st === status);
  return entry ? Number(entry[0]) : null;
}

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

// Status que significam que o item não está mais realmente "em
// importação" (cancelado, ou consolidado dentro de outro processo) —
// ficam ocultos por padrão na listagem e não contam pro cruzamento com o
// Pedido de Compra (ver app/em-importacao/actions.ts e page.tsx).
export const EXTERNAL_IMPORT_ITEM_INACTIVE_STATUSES = [
  "CANCELADO",
  "CONSOLIDADO_EM_OUTRO_PROCESSO",
] as const satisfies readonly ExternalImportItemStatus[];

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
    month: "2-digit",
    year: "2-digit",
    timeZone: "UTC",
  });
}
