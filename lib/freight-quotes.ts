// Cotações de frete de um processo (tabela process_freight_quotes): cada valor
// tem a própria moeda, então o total de uma cotação é uma soma por moeda
// ("USD 2.239,29 + BRL 700,00"). Só dá pra comparar cotações entre si em reais
// quando há câmbio do processo para a moeda estrangeira usada.

export type QuoteAmounts = {
  freightValue: string | null;
  freightCurrency: string;
  originFeesValue: string | null;
  originFeesCurrency: string;
  destinationFeesValue: string | null;
  destinationFeesCurrency: string;
  otherFeesValue: string | null;
  otherFeesCurrency: string;
};

function num(v: string | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// Linhas de custo (frete, origem, destino, outras) com valor informado.
export function quoteLines(q: QuoteAmounts) {
  return [
    { key: "freight", value: num(q.freightValue), currency: q.freightCurrency, filled: q.freightValue !== null },
    { key: "origin", value: num(q.originFeesValue), currency: q.originFeesCurrency, filled: q.originFeesValue !== null },
    { key: "destination", value: num(q.destinationFeesValue), currency: q.destinationFeesCurrency, filled: q.destinationFeesValue !== null },
    { key: "other", value: num(q.otherFeesValue), currency: q.otherFeesCurrency, filled: q.otherFeesValue !== null },
  ] as const;
}

// Total por moeda, na ordem em que as moedas aparecem.
export function quoteTotalsByCurrency(q: QuoteAmounts): { currency: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const line of quoteLines(q)) {
    if (!line.filled) continue;
    totals.set(line.currency, (totals.get(line.currency) ?? 0) + line.value);
  }
  return [...totals.entries()].map(([currency, value]) => ({ currency, value }));
}

// Total em reais: BRL entra direto; a moeda do processo usa o câmbio do
// processo; qualquer outra moeda não tem como converter (retorna null).
export function quoteTotalBRL(
  q: QuoteAmounts,
  processCurrency: string | null,
  rate: number | null,
): number | null {
  let total = 0;
  for (const line of quoteLines(q)) {
    if (!line.filled) continue;
    if (line.currency === "BRL") total += line.value;
    else if (rate && processCurrency && line.currency === processCurrency) total += line.value * rate;
    else return null;
  }
  return total;
}

// O que vai para o "Frete Internacional" do processo ao escolher a cotação:
// frete + taxas de origem (entram no valor aduaneiro; taxas de destino e
// outras, não). Só copia quando as duas linhas estão na mesma moeda, que
// também precisa ser a do processo (ou o processo ainda não ter moeda).
export function freightToApply(
  q: QuoteAmounts,
  processCurrency: string | null,
): { value: number; currency: string } | { value: null; reason: string } {
  const lines = quoteLines(q).filter((l) => (l.key === "freight" || l.key === "origin") && l.filled && l.value > 0);
  if (lines.length === 0) return { value: null, reason: "A cotação não tem frete nem taxa de origem informados." };
  const currency = processCurrency ?? lines[0].currency;
  if (lines.some((l) => l.currency !== currency)) {
    return {
      value: null,
      reason: `Frete e taxa de origem estão em moedas diferentes da moeda do processo (${currency}), então o Frete Internacional não foi alterado — preencha-o manualmente.`,
    };
  }
  return { value: lines.reduce((s, l) => s + l.value, 0), currency };
}

export function formatMoney(value: number, currency: string): string {
  const n = value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === "BRL" ? `R$ ${n}` : `${currency} ${n}`;
}
