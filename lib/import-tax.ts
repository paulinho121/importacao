// Fórmula em cascata padrão de tributos de importação — alíquotas
// cadastradas manualmente por produto/NCM (sem integração com a tabela
// TEC). Todas as alíquotas são percentuais (ex: 12.5 = 12,5%).
export type ImportTaxRates = {
  taxRateII: number | null;
  taxRateIPI: number | null;
  taxRatePIS: number | null;
  taxRateCOFINS: number | null;
  taxRateICMS: number | null;
};

export type ImportTaxBreakdown = {
  ii: number;
  ipi: number;
  pis: number;
  cofins: number;
  icms: number;
  total: number;
};

export function calcImportTaxes(valorAduaneiroItem: number, rates: ImportTaxRates): ImportTaxBreakdown {
  const aliqII = (rates.taxRateII ?? 0) / 100;
  const aliqIPI = (rates.taxRateIPI ?? 0) / 100;
  const aliqPIS = (rates.taxRatePIS ?? 0) / 100;
  const aliqCOFINS = (rates.taxRateCOFINS ?? 0) / 100;
  const aliqICMS = (rates.taxRateICMS ?? 0) / 100;

  const ii = valorAduaneiroItem * aliqII;
  const ipi = (valorAduaneiroItem + ii) * aliqIPI;
  const pis = valorAduaneiroItem * aliqPIS;
  const cofins = valorAduaneiroItem * aliqCOFINS;
  // ICMS "por dentro" — a base já inclui o próprio imposto, padrão
  // brasileiro. Guarda contra alíquota >= 100% (não faz sentido, mas
  // evitaria divisão por zero/negativo).
  const baseAntesICMS = valorAduaneiroItem + ii + ipi + pis + cofins;
  const icms = aliqICMS > 0 && aliqICMS < 1 ? (baseAntesICMS / (1 - aliqICMS)) * aliqICMS : 0;

  return { ii, ipi, pis, cofins, icms, total: ii + ipi + pis + cofins + icms };
}
