export type ProcessStatus =
  | "PEDIDO"
  | "PRODUCAO"
  | "COLETADO_ORIGEM"
  | "AGUARDANDO_EMBARQUE"
  | "EMBARCADO"
  | "EM_TRANSITO"
  | "AGUARDANDO_PRESENCA_CARGA"
  | "PRESENCA_CARGA"
  | "EM_DESEMBARACO"
  | "CARGA_REGISTRADA"
  | "TRANSPORTE_NACIONAL"
  | "RECEBIDO"
  | "ATRASADO"
  | "CONCLUIDO"
  | "ABANDONADO";

// Sequência do fluxo definida pelo time (WhatsApp, nov/2026): Pedido, Produção,
// Coletado na Origem, Aguardando Embarque, Embarcado, Em Trânsito, Aguardando
// Presença de Carga, Presença de Carga, Desembaraçado, Carga Registrada (DUIMP
// feita) aguardando retirada, Em Trânsito Nacional, Em Estoque. Os valores do
// enum no banco foram mantidos (só ganharam rótulos novos); EM_DESEMBARACO
// exibe "Desembaraçado", TRANSPORTE_NACIONAL "Em Trânsito Nacional" e RECEBIDO
// "Em Estoque". Atrasado, Finalizado e Abandonado ficam fora da sequência:
// são ajustes/fechamentos manuais.
// Processos encerrados: saem do fluxo e vão para /finalizados.
export const CLOSED_PROCESS_STATUSES = ["CONCLUIDO", "ABANDONADO"] as const;

// A ordem das chaves é a ordem em que o select de status aparece na tela.
export const STATUS_LABEL: Record<ProcessStatus, string> = {
  PEDIDO: "Pedido",
  PRODUCAO: "Produção",
  COLETADO_ORIGEM: "Coletado na Origem",
  AGUARDANDO_EMBARQUE: "Aguardando Embarque",
  EMBARCADO: "Embarcado",
  EM_TRANSITO: "Em Trânsito",
  AGUARDANDO_PRESENCA_CARGA: "Aguardando Presença de Carga",
  PRESENCA_CARGA: "Presença de Carga",
  EM_DESEMBARACO: "Desembaraçado",
  CARGA_REGISTRADA: "Carga Registrada (DUIMP) — Aguardando Retirada",
  TRANSPORTE_NACIONAL: "Em Trânsito Nacional",
  RECEBIDO: "Em Estoque",
  ATRASADO: "Atrasado",
  CONCLUIDO: "Finalizado",
  ABANDONADO: "Abandonado",
};

export const STATUS_BADGE_CLASS: Record<ProcessStatus, string> = {
  PEDIDO: "bg-surface-container-high text-on-surface-variant",
  PRODUCAO: "bg-surface-container-high text-on-surface-variant",
  COLETADO_ORIGEM: "bg-surface-container-high text-on-surface-variant",
  AGUARDANDO_EMBARQUE: "bg-surface-container-high text-on-surface-variant",
  EMBARCADO: "bg-secondary-fixed text-on-secondary-fixed-variant",
  EM_TRANSITO: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  AGUARDANDO_PRESENCA_CARGA: "bg-surface-container-high text-on-surface-variant",
  PRESENCA_CARGA: "bg-secondary-fixed text-on-secondary-fixed-variant",
  EM_DESEMBARACO: "bg-secondary-fixed text-on-secondary-fixed-variant",
  CARGA_REGISTRADA: "bg-secondary-fixed text-on-secondary-fixed-variant",
  TRANSPORTE_NACIONAL: "bg-secondary-fixed text-on-secondary-fixed-variant",
  RECEBIDO: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  ATRASADO: "bg-error-container text-on-error-container",
  CONCLUIDO: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  // Mesmo tratamento visual de "Cancelado" no registro de itens em
  // importação (lib/status.ts) — vermelho neutro, não é urgência (não
  // precisa de ação), é só "isso não vingou".
  ABANDONADO: "bg-error-container text-on-error-container",
};

export const STATUS_ICON: Record<ProcessStatus, string> = {
  PEDIDO: "receipt_long",
  PRODUCAO: "precision_manufacturing",
  COLETADO_ORIGEM: "inventory",
  AGUARDANDO_EMBARQUE: "schedule",
  EMBARCADO: "flight_takeoff",
  EM_TRANSITO: "local_shipping",
  AGUARDANDO_PRESENCA_CARGA: "hourglass_top",
  PRESENCA_CARGA: "how_to_reg",
  EM_DESEMBARACO: "gavel",
  CARGA_REGISTRADA: "assignment_turned_in",
  TRANSPORTE_NACIONAL: "local_shipping",
  RECEBIDO: "inventory_2",
  ATRASADO: "warning",
  CONCLUIDO: "check_circle",
  ABANDONADO: "cancel",
};

// 12 etapas do fluxo, na sequência do time. "Finalizado" (CONCLUIDO) não é
// uma etapa do stepper — só se atinge via o select manual de status, igual
// "Atrasado".
export const WORKFLOW_STEPS = [
  "Pedido",
  "Produção",
  "Coletado na Origem",
  "Aguardando Embarque",
  "Embarcado",
  "Em Trânsito",
  "Aguardando Presença de Carga",
  "Presença de Carga",
  "Desembaraçado",
  "Carga Registrada (DUIMP)",
  "Em Trânsito Nacional",
  "Em Estoque",
] as const;

// Regra de negócio: qual status resulta de estar em cada etapa do fluxo.
// ATRASADO/CONCLUIDO ficam fora dessa progressão — são correção/fechamento
// manual (ver updateProcessStatus), não etapas alcançadas ao avançar.
export const STATUS_BY_STEP: Record<number, ProcessStatus> = {
  1: "PEDIDO",
  2: "PRODUCAO",
  3: "COLETADO_ORIGEM",
  4: "AGUARDANDO_EMBARQUE",
  5: "EMBARCADO",
  6: "EM_TRANSITO",
  7: "AGUARDANDO_PRESENCA_CARGA",
  8: "PRESENCA_CARGA",
  9: "EM_DESEMBARACO",
  10: "CARGA_REGISTRADA",
  11: "TRANSPORTE_NACIONAL",
  12: "RECEBIDO",
};

// Etapa (1..12) de um status da sequência; null para Atrasado/Finalizado/Abandonado.
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
