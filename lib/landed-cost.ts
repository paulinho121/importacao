import { calcImportTaxes, type ImportTaxBreakdown } from "@/lib/import-tax";

// Valor Aduaneiro estimado (invoices + frete + seguro, convertido por
// câmbio). Extraído daqui pra parar de duplicar essa conta em
// ProcessFinancials.tsx e lib/dashboard-metrics.ts.
export function calcValorAduaneiro({
  invoicesSum,
  freight,
  insurance,
  rate,
}: {
  invoicesSum: number;
  freight: number;
  insurance: number;
  rate: number;
}): number {
  return (invoicesSum + freight + insurance) * rate;
}

export type LandedCostItemInput = {
  id: string;
  sku: string | null;
  description: string;
  quantity: string | number | null;
  unitValueOverride: string | number | null;
  product: {
    costPrice: string | number | null;
    taxRateII: string | number | null;
    taxRateIPI: string | number | null;
    taxRatePIS: string | number | null;
    taxRateCOFINS: string | number | null;
    taxRateICMS: string | number | null;
  } | null;
};

export type LandedCostItemResult = {
  id: string;
  sku: string | null;
  description: string;
  quantity: number;
  valorFOB: number;
  participacaoPct: number;
  taxes: ImportTaxBreakdown;
  custoPousadoTotal: number;
  custoPousadoUnitario: number;
};

function toNumber(value: string | number | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Rateia Valor Aduaneiro + contas a pagar (já em BRL) por item, na
// proporção do valor de cada um (unitValueOverride, senão
// products.costPrice) — padrão ad valorem. Se algum item não tiver
// nenhum dos dois, cai pra rateio por quantidade em TODOS os itens (pra
// não misturar os dois critérios no mesmo processo). Tributos são
// calculados por item, em cima do Valor Aduaneiro daquele item —
// somados ao custo pousado, não rateados por fora. Tudo calculado na
// leitura, nunca armazenado.
export function calcLandedCostByItem({
  items,
  valorAduaneiro,
  payablesBRL,
}: {
  items: LandedCostItemInput[];
  valorAduaneiro: number;
  payablesBRL: number;
}): { items: LandedCostItemResult[]; usedFallbackQuantity: boolean } {
  const parsed = items.map((item) => {
    const quantity = toNumber(item.quantity) ?? 0;
    const override = toNumber(item.unitValueOverride);
    const catalogCost = toNumber(item.product?.costPrice ?? null);
    const unitValue = override ?? catalogCost;
    const basis = unitValue !== null ? unitValue * quantity : null;
    return { item, quantity, basis };
  });

  const usedFallbackQuantity = parsed.some((p) => p.basis === null);
  const weightOf = (p: (typeof parsed)[number]) => (usedFallbackQuantity ? p.quantity : (p.basis ?? 0));
  const totalWeight = parsed.reduce((sum, p) => sum + weightOf(p), 0);
  const totalToAllocate = valorAduaneiro + payablesBRL;

  const results: LandedCostItemResult[] = parsed.map(({ item, quantity, basis }) => {
    const p = { item, quantity, basis };
    const w = weightOf(p);
    const share = totalWeight > 0 ? w / totalWeight : 0;
    const valorAduaneiroItem = share * valorAduaneiro;
    const taxes = calcImportTaxes(valorAduaneiroItem, {
      taxRateII: toNumber(item.product?.taxRateII ?? null),
      taxRateIPI: toNumber(item.product?.taxRateIPI ?? null),
      taxRatePIS: toNumber(item.product?.taxRatePIS ?? null),
      taxRateCOFINS: toNumber(item.product?.taxRateCOFINS ?? null),
      taxRateICMS: toNumber(item.product?.taxRateICMS ?? null),
    });
    const custoPousadoTotal = share * totalToAllocate + taxes.total;

    return {
      id: item.id,
      sku: item.sku,
      description: item.description,
      quantity,
      valorFOB: basis ?? 0,
      participacaoPct: share * 100,
      taxes,
      custoPousadoTotal,
      custoPousadoUnitario: quantity > 0 ? custoPousadoTotal / quantity : 0,
    };
  });

  return { items: results, usedFallbackQuantity };
}
