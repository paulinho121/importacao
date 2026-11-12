// Atraso automático pela ETA. "Atrasado" NÃO é uma etapa do processo: é um
// indicador calculado na hora.
//
// Regra: o processo está atrasado quando a ETA (previsão de chegada) já passou
// e a presença de carga ainda não foi confirmada. Ao chegar na etapa "Presença de
// Carga" (ou qualquer uma depois dela) o alerta se encerra sozinho. Se a ETA for
// atualizada, o cálculo usa a nova data (as alterações ficam no histórico).

export const CARGO_PRESENT_STEP = 13; // "Presença de Carga" na sequência do processo
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
  if (p.currentStep >= CARGO_PRESENT_STEP) return null; // presença de carga confirmada
  const today = Date.parse(`${todayInSaoPaulo(now)}T00:00:00Z`);
  const eta = Date.parse(`${p.etaEstimated}T00:00:00Z`);
  if (Number.isNaN(eta)) return null;
  const days = Math.round((today - eta) / 86_400_000);
  return days > 0 ? days : null;
}

export const isCargoPresent = (currentStep: number) => currentStep >= CARGO_PRESENT_STEP;

// Mesma regra em SQL (filtro "somente atrasados" da lista de processos).
export const LATE_BY_ETA_SQL = `
  processes.eta_estimated is not null
  and processes.eta_estimated < (now() at time zone 'America/Sao_Paulo')::date
  and processes.current_step < ${CARGO_PRESENT_STEP}
  and processes.status not in ('CONCLUIDO', 'ABANDONADO')`;
