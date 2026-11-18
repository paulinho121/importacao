// Atraso automático pela ETA. "Atrasado" NÃO é uma etapa do processo: é um
// indicador calculado na hora.
//
// Regra: o processo está atrasado quando a ETA (previsão de chegada) já passou
// e a chegada ainda não foi confirmada. Ao chegar na etapa "Aguardando Presença
// de Carga" (chegada confirmada) ou em qualquer uma depois dela, o alerta de ETA
// se encerra e a ETA deixa de ser tratada como pendente.
//
// A partir da confirmação de chegada começa uma nova contagem de 48 horas (data e
// hora em que o status mudou). Se passar disso sem o processo ir para "Presença
// de Carga", aparece o alerta de pendência de presença de carga.

export const ARRIVAL_CONFIRMED_STEP = 12; // "Aguardando Presença de Carga" = chegada confirmada
export const CARGO_PRESENT_STEP = 13; // "Presença de Carga"
export const PRESENCE_DEADLINE_HOURS = 48;
const CLOSED = ["CONCLUIDO", "ABANDONADO"];

// Hoje no fuso do Brasil, como YYYY-MM-DD (comparação de datas sem horário).
export function todayInSaoPaulo(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

// Dias de atraso (>= 1) ou null quando o processo não está atrasado.
export function etaLateDays(
  p: { status: string; currentStep: number; etaEstimated: string | null },
  now = new Date(),
): number | null {
  if (!p.etaEstimated) return null;
  if (CLOSED.includes(p.status)) return null;
  if (p.currentStep >= ARRIVAL_CONFIRMED_STEP) return null; // chegada confirmada: ETA não está mais pendente
  const today = Date.parse(`${todayInSaoPaulo(now)}T00:00:00Z`);
  const eta = Date.parse(`${p.etaEstimated}T00:00:00Z`);
  if (Number.isNaN(eta)) return null;
  const days = Math.round((today - eta) / 86_400_000);
  return days > 0 ? days : null;
}

// Chegada já confirmada (a previsão de ETA deixa de contar como pendente).
export const isArrivalConfirmed = (currentStep: number) => currentStep >= ARRIVAL_CONFIRMED_STEP;

export const isCargoPresent = (currentStep: number) => currentStep >= CARGO_PRESENT_STEP;

// Horas desde a confirmação de chegada, quando o processo continua em "Aguardando
// Presença de Carga" há 48 h ou mais; senão null.
export function cargoPresencePendingHours(
  p: {
    status: string;
    currentStep: number;
    statusChangedAt: Date | string | null;
    updatedAt: Date | string | null;
  },
  now = new Date(),
): number | null {
  if (CLOSED.includes(p.status)) return null;
  if (p.currentStep !== ARRIVAL_CONFIRMED_STEP) return null;
  const since = p.statusChangedAt ?? p.updatedAt;
  if (!since) return null;
  const hours = (now.getTime() - new Date(since).getTime()) / 3_600_000;
  return hours >= PRESENCE_DEADLINE_HOURS ? Math.floor(hours) : null;
}

// Mesma regra de atraso da ETA em SQL (filtro "somente atrasados" da lista de processos).
export const LATE_BY_ETA_SQL = `
  processes.eta_estimated is not null
  and processes.eta_estimated < (now() at time zone 'America/Sao_Paulo')::date
  and processes.current_step < ${ARRIVAL_CONFIRMED_STEP}
  and processes.status not in ('CONCLUIDO', 'ABANDONADO')`;
