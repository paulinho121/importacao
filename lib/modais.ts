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
