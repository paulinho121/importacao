// Cotações de frete de um processo: o cabeçalho (process_freight_quotes) tem
// os dados do embarque e da carga; os valores ficam em linhas
// (process_freight_quote_lines), cada uma com a própria moeda. O total de uma
// cotação é uma soma por moeda ("USD 2.094,43 + BRL 589,00"), igual ao
// "Resumo de despesas" das propostas dos agentes. Só dá pra comparar cotações
// em reais quando há câmbio do processo para a moeda estrangeira usada.

export type QuoteSection = "FRETE" | "ORIGEM" | "DESTINO" | "OUTRAS";

export const QUOTE_SECTIONS: {
  value: QuoteSection;
  label: string;
  hint: string;
  defaultCurrency: string;
  suggestions: string[];
}[] = [
  {
    value: "FRETE",
    label: "Frete internacional",
    hint: "Tarifa do frete (ex.: 220 kg × USD 7,00/kg).",
    defaultCurrency: "USD",
    suggestions: ["Frete aéreo", "Frete marítimo", "Frete rodoviário", "BAF / fuel", "Security fee"],
  },
  {
    value: "ORIGEM",
    label: "Despesas na origem",
    hint: "Taxas cobradas no país de embarque.",
    defaultCurrency: "USD",
    suggestions: ["Airport transfer", "Customs clearance", "Doc fee", "Handling origin", "Pick up", "THC origem"],
  },
  {
    value: "DESTINO",
    label: "Despesas no destino",
    hint: "Taxas cobradas no Brasil.",
    defaultCurrency: "USD",
    suggestions: ["CCT", "Collect fee", "Delivery fee", "Desconsolidação", "Ad valorem", "Entrega", "THC destino", "Armazenagem"],
  },
  {
    value: "OUTRAS",
    label: "Outras taxas / custo adicional",
    hint: "DTA, seguro, descontos ou qualquer custo extra.",
    defaultCurrency: "BRL",
    suggestions: ["DTA", "Seguro", "Despachante", "Custo adicional", "Desconto"],
  },
];

export const QUOTE_UNITS: { value: string; label: string }[] = [
  { value: "", label: "—" },
  { value: "KG", label: "por kg" },
  { value: "HAWB", label: "por HAWB" },
  { value: "PROCESSO", label: "por processo" },
  { value: "CONTAINER", label: "por contêiner" },
  { value: "VOLUME", label: "por volume" },
  { value: "PERCENT", label: "por %" },
  { value: "FIXO", label: "valor fixo" },
];

export function quoteUnitLabel(unit: string | null | undefined): string {
  return QUOTE_UNITS.find((u) => u.value === unit)?.label ?? "";
}

export type QuoteLineAmount = {
  section: string;
  currency: string;
  total: string | number;
};

function num(v: string | number | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// Total da linha a partir de quantidade × tarifa, respeitando o mínimo da
// proposta. Retorna null quando faltam quantidade e tarifa.
export function computeLineTotal(
  quantity: number | null,
  unitPrice: number | null,
  minimum: number | null,
): number | null {
  if (quantity === null || unitPrice === null) return minimum !== null && minimum > 0 ? minimum : null;
  const raw = quantity * unitPrice;
  return Math.round(Math.max(raw, minimum ?? 0) * 100) / 100;
}

// Soma por moeda, na ordem em que as moedas aparecem; opcionalmente só uma seção.
export function totalsByCurrency(
  lines: QuoteLineAmount[],
  section?: QuoteSection,
): { currency: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const l of lines) {
    if (section && l.section !== section) continue;
    totals.set(l.currency, (totals.get(l.currency) ?? 0) + num(l.total));
  }
  return [...totals.entries()].map(([currency, value]) => ({ currency, value }));
}

// Total em reais: BRL entra direto; a moeda do processo usa o câmbio do
// processo; qualquer outra moeda não tem como converter (retorna null).
export function totalBRL(
  lines: QuoteLineAmount[],
  processCurrency: string | null,
  rate: number | null,
): number | null {
  let total = 0;
  for (const l of lines) {
    const v = num(l.total);
    if (l.currency === "BRL") total += v;
    else if (rate && processCurrency && l.currency === processCurrency) total += v * rate;
    else return null;
  }
  return total;
}

// O que vai para o "Frete Internacional" do processo ao escolher a cotação:
// frete + despesas de origem (entram no valor aduaneiro; destino e outras,
// não). Só copia quando tudo está numa moeda só, que também precisa ser a do
// processo (ou o processo ainda não ter moeda).
export function freightToApply(
  lines: QuoteLineAmount[],
  processCurrency: string | null,
): { value: number; currency: string } | { value: null; reason: string } {
  const relevant = lines.filter((l) => (l.section === "FRETE" || l.section === "ORIGEM") && num(l.total) > 0);
  if (relevant.length === 0) {
    return { value: null, reason: "A cotação não tem frete nem despesas de origem informados." };
  }
  const currency = processCurrency ?? relevant[0].currency;
  if (relevant.some((l) => l.currency !== currency)) {
    return {
      value: null,
      reason: `Frete e despesas de origem estão em moedas diferentes da moeda do processo (${currency}), então o Frete Internacional não foi alterado — preencha-o manualmente.`,
    };
  }
  return { value: relevant.reduce((s, l) => s + num(l.total), 0), currency };
}

export function formatMoney(value: number, currency: string): string {
  const n = value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === "BRL" ? `R$ ${n}` : `${currency} ${n}`;
}

// "8 a 15 dias" / "8 dias".
export function transitLabel(min: number | null, max: number | null): string {
  if (min !== null && max !== null && max !== min) return `${min} a ${max} dias`;
  const v = min ?? max;
  return v !== null ? `${v} dias` : "—";
}
