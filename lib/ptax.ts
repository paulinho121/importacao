// Integração com a API pública do Banco Central (Olinda/PTAX) — gratuita,
// sem autenticação. Usada só sob ação manual do usuário ("Buscar câmbio"),
// nunca automaticamente em cada carregamento de página (mesmo princípio de
// lib/datalastic.ts).

const BASE_URL =
  "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)";

const MAX_DAYS_BACK = 7;

export type PtaxCurrency = "USD" | "EUR" | "CNY" | "GBP" | "JPY";

export type PtaxRate = {
  // Cotação de venda do dia — referência convencional para custo de importação.
  rate: number;
  // Data efetivamente usada (Bacen não publica em fins de semana/feriado —
  // pode ser anterior à data pedida).
  date: string;
};

export type PtaxFetchResult = { ok: true; data: PtaxRate } | { ok: false; error: string };

function toBacenDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${month}-${day}-${year}`;
}

function shiftIsoDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function fetchOneDay(
  currency: PtaxCurrency,
  isoDate: string,
): Promise<{ rate: number } | null> {
  const url = new URL(BASE_URL);
  url.searchParams.set("@moeda", `'${currency}'`);
  url.searchParams.set("@dataCotacao", `'${toBacenDate(isoDate)}'`);
  url.searchParams.set("$format", "json");

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Bacen retornou erro (HTTP ${response.status}).`);
  }

  const body = await response.json();
  const entries: Array<{ cotacaoVenda?: number }> = body?.value ?? [];
  const last = entries.at(-1);
  if (!last || typeof last.cotacaoVenda !== "number") return null;

  return { rate: last.cotacaoVenda };
}

export async function fetchPtaxRate(params: {
  currency: PtaxCurrency;
  date: string; // ISO "YYYY-MM-DD"
}): Promise<PtaxFetchResult> {
  let cursor = params.date;

  try {
    for (let i = 0; i <= MAX_DAYS_BACK; i++) {
      const result = await fetchOneDay(params.currency, cursor);
      if (result) {
        return { ok: true, data: { rate: result.rate, date: cursor } };
      }
      cursor = shiftIsoDate(cursor, -1);
    }
  } catch {
    return { ok: false, error: "Falha de rede ao consultar a cotação do Bacen." };
  }

  return {
    ok: false,
    error: `Bacen não publicou cotação de ${params.currency} nos últimos ${MAX_DAYS_BACK} dias corridos a partir de ${params.date}.`,
  };
}
