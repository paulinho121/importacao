// Cotação com o fornecedor (valores dos produtos, condições comerciais,
// pagamento, prazo de produção). É independente da cotação do agente de
// cargas: nenhuma das duas exige a aprovação da outra.

export type SupplierQuoteStatus =
  | "SOLICITADA"
  | "RECEBIDA"
  | "EM_NEGOCIACAO"
  | "APROVADA"
  | "RECUSADA"
  | "EXPIRADA";

export const SUPPLIER_QUOTE_STATUSES: { value: SupplierQuoteStatus; label: string; color: string }[] = [
  { value: "SOLICITADA", label: "Solicitada", color: "#5b6b85" },
  { value: "RECEBIDA", label: "Recebida", color: "#2b7bbf" },
  { value: "EM_NEGOCIACAO", label: "Em negociação", color: "#d99a14" },
  { value: "APROVADA", label: "Aprovada", color: "#16a34a" },
  { value: "RECUSADA", label: "Recusada", color: "#d9534f" },
  { value: "EXPIRADA", label: "Expirada", color: "#8a8f98" },
];

export function isSupplierQuoteStatus(v: string): v is SupplierQuoteStatus {
  return SUPPLIER_QUOTE_STATUSES.some((s) => s.value === v);
}

export function supplierQuoteStatusLabel(v: string): string {
  return SUPPLIER_QUOTE_STATUSES.find((s) => s.value === v)?.label ?? v;
}

// Máximo de itens detalhados por cotação.
export const MAX_SUPPLIER_QUOTE_ITEMS = 60;

// quantidade × preço unitário, arredondado em centavos; null se faltar algum.
export function supplierItemTotal(quantity: number | null, unitPrice: number | null): number | null {
  if (quantity === null || unitPrice === null) return null;
  return Math.round(quantity * unitPrice * 100) / 100;
}
