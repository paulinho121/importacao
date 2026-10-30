// Modais de transporte (valores do enum `modal` em db/schema.ts) — usados
// nos formulários de criação e edição de processo.
export const MODAIS = [
  { value: "", label: "Selecione o modal" },
  { value: "AIR", label: "Aéreo" },
  { value: "SEA_FCL", label: "Marítimo FCL" },
  { value: "SEA_LCL", label: "Marítimo LCL" },
  { value: "SEA_BREAK_BULK", label: "Marítimo Break Bulk" },
  { value: "SEA_RORO", label: "Marítimo RORO" },
  { value: "COURIER", label: "Courier" },
  { value: "ROAD", label: "Rodoviário" },
];

// Modalidade (Marítimo/Aéreo/Terrestre) separada do tipo de embarque (FCL,
// Air Cargo, FTL…), como na aba "Tipo de Embarques" da planilha do time. O
// enum `modal` dos processos continua sendo a classificação estruturada que
// filtros e ícones usam: ele é derivado do tipo escolhido (modalCode), e o
// nome do tipo fica em processes.container_type.
export type Modalidade = "MARITIMO" | "AEREO" | "TERRESTRE";

export const MODALIDADES: { value: Modalidade; label: string }[] = [
  { value: "MARITIMO", label: "Marítimo" },
  { value: "AEREO", label: "Aéreo" },
  { value: "TERRESTRE", label: "Terrestre" },
];

export const TIPOS_EMBARQUE: { modalidade: Modalidade; value: string; modalCode: string }[] = [
  { modalidade: "MARITIMO", value: "FCL", modalCode: "SEA_FCL" },
  { modalidade: "MARITIMO", value: "LCL", modalCode: "SEA_LCL" },
  { modalidade: "MARITIMO", value: "Break Bulk", modalCode: "SEA_BREAK_BULK" },
  { modalidade: "MARITIMO", value: "RORO", modalCode: "SEA_RORO" },
  { modalidade: "MARITIMO", value: "FCL 20'", modalCode: "SEA_FCL" },
  { modalidade: "MARITIMO", value: "FCL 20' HC", modalCode: "SEA_FCL" },
  { modalidade: "MARITIMO", value: "FCL 40'", modalCode: "SEA_FCL" },
  { modalidade: "MARITIMO", value: "FCL 40' HC", modalCode: "SEA_FCL" },
  { modalidade: "MARITIMO", value: "FCL 20' NOR", modalCode: "SEA_FCL" },
  { modalidade: "MARITIMO", value: "FCL 40' NOR", modalCode: "SEA_FCL" },
  { modalidade: "AEREO", value: "Air Cargo", modalCode: "AIR" },
  { modalidade: "AEREO", value: "Courier", modalCode: "COURIER" },
  { modalidade: "AEREO", value: "Consolidated", modalCode: "AIR" },
  { modalidade: "TERRESTRE", value: "FTL", modalCode: "ROAD" },
  { modalidade: "TERRESTRE", value: "LTL", modalCode: "ROAD" },
  { modalidade: "TERRESTRE", value: "Cross-border trucking", modalCode: "ROAD" },
];

export function modalidadeFromModal(modal: string | null | undefined): Modalidade | null {
  if (!modal) return null;
  if (modal.startsWith("SEA_")) return "MARITIMO";
  if (modal === "AIR" || modal === "COURIER") return "AEREO";
  if (modal === "ROAD") return "TERRESTRE";
  return null;
}

export function modalidadeLabel(modal: string | null | undefined): string {
  const m = modalidadeFromModal(modal);
  return MODALIDADES.find((x) => x.value === m)?.label ?? "—";
}

export function modalFromTipo(tipo: string | null | undefined): string | null {
  return TIPOS_EMBARQUE.find((t) => t.value === tipo)?.modalCode ?? null;
}

// Tipo a mostrar quando o processo não tem container_type gravado (processos
// antigos só têm o `modal`).
const DEFAULT_TIPO_BY_MODAL: Record<string, string> = {
  SEA_FCL: "FCL",
  SEA_LCL: "LCL",
  SEA_BREAK_BULK: "Break Bulk",
  SEA_RORO: "RORO",
  AIR: "Air Cargo",
  COURIER: "Courier",
};

export function tipoEmbarqueLabel(modal: string | null | undefined, containerType: string | null | undefined): string {
  return containerType || (modal ? DEFAULT_TIPO_BY_MODAL[modal] : undefined) || "—";
}
