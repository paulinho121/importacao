export type PriceTier = { minQuantity: string | number; price: string | number };

// Maior faixa cujo minQuantity <= quantity vence; sem faixa aplicável,
// cai no preço base (costPrice do produto).
export function resolveTieredPrice(
  tiers: PriceTier[],
  quantity: number | null | undefined,
  basePrice: string | number | null,
): string | null {
  if (quantity && tiers.length > 0) {
    const applicable = tiers
      .filter((t) => Number(t.minQuantity) <= quantity)
      .sort((a, b) => Number(b.minQuantity) - Number(a.minQuantity))[0];
    if (applicable) return String(applicable.price);
  }
  return basePrice != null ? String(basePrice) : null;
}
