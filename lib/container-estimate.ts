// Estima cubagem (m³) e quantos containers um pedido de compra vai
// precisar, a partir das especificações de carton do catálogo
// (products.carton*) e da quantidade de cada item do pedido.
//
// Capacidades por tipo de container são valores práticos/aproximados de
// mercado (variam por armador e eficiência de paletização) — por isso o
// resultado é sempre uma ESTIMATIVA, nunca um número garantido. Peso
// máximo é o payload típico (peso bruto do container - tara), não o peso
// bruto máximo do container vazio.
export type ContainerType = "20DRY" | "40DRY" | "40HC";

export const CONTAINER_SPECS: Record<ContainerType, { label: string; usableCbm: number; maxPayloadKg: number }> = {
  "20DRY": { label: "20' Dry (Standard)", usableCbm: 28, maxPayloadKg: 28000 },
  "40DRY": { label: "40' Dry (Standard)", usableCbm: 58, maxPayloadKg: 26500 },
  "40HC": { label: "40' High Cube", usableCbm: 68, maxPayloadKg: 26500 },
};

export type CartonSpec = {
  piecesPerCarton: number | null;
  cartonLengthCm: number | null;
  cartonWidthCm: number | null;
  cartonHeightCm: number | null;
  cartonWeightKg: number | null;
};

export function cartonCbm(spec: CartonSpec): number | null {
  if (spec.cartonLengthCm === null || spec.cartonWidthCm === null || spec.cartonHeightCm === null) return null;
  return (spec.cartonLengthCm * spec.cartonWidthCm * spec.cartonHeightCm) / 1_000_000;
}

export type ItemEstimateInput = {
  id: string;
  description: string;
  quantity: number;
  spec: CartonSpec | null; // null = item avulso ou produto sem specs cadastradas
};

export type ItemEstimateResult = {
  id: string;
  description: string;
  quantity: number;
  cartons: number | null;
  cbm: number | null;
  weightKg: number | null;
  missingSpecs: boolean;
};

export function estimateItems(items: ItemEstimateInput[]): ItemEstimateResult[] {
  return items.map((item) => {
    const spec = item.spec;
    const piecesPerCarton = spec?.piecesPerCarton ?? null;
    const cbmPerCarton = spec ? cartonCbm(spec) : null;
    const weightPerCarton = spec?.cartonWeightKg ?? null;

    if (!piecesPerCarton || cbmPerCarton === null || weightPerCarton === null || item.quantity <= 0) {
      return {
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        cartons: null,
        cbm: null,
        weightKg: null,
        missingSpecs: true,
      };
    }

    const cartons = Math.ceil(item.quantity / piecesPerCarton);
    return {
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      cartons,
      cbm: cartons * cbmPerCarton,
      weightKg: cartons * weightPerCarton,
      missingSpecs: false,
    };
  });
}

export type ContainerSuggestion = {
  type: ContainerType;
  label: string;
  containersNeeded: number;
  boundBy: "volume" | "peso";
  volumeUtilizationPct: number;
  weightUtilizationPct: number;
};

export function suggestContainers(totalCbm: number, totalWeightKg: number): ContainerSuggestion[] {
  return (Object.keys(CONTAINER_SPECS) as ContainerType[]).map((type) => {
    const spec = CONTAINER_SPECS[type];
    const byVolume = Math.ceil(totalCbm / spec.usableCbm);
    const byWeight = Math.ceil(totalWeightKg / spec.maxPayloadKg);
    const containersNeeded = Math.max(1, byVolume, byWeight);
    const boundBy: "volume" | "peso" = byWeight > byVolume ? "peso" : "volume";
    return {
      type,
      label: spec.label,
      containersNeeded,
      boundBy,
      volumeUtilizationPct: Math.round((totalCbm / (containersNeeded * spec.usableCbm)) * 100),
      weightUtilizationPct: Math.round((totalWeightKg / (containersNeeded * spec.maxPayloadKg)) * 100),
    };
  });
}
