// Fluxo do produto, em 3 etapas:
//  1. Cadastro completo (com foto)
//  2. Consulta Pública (CP): conferir se já existe; se não, solicitar e acompanhar
//  3. Benefício (LPCO) pedido para o estado do pedido (SP/SC/CE), válido por
//     LPCO_REUSE_DAYS dias — com contagem do tempo que falta (lib/lpco.ts)

// Situação da CP (lista de status do time). "POSSUI" é o código gravado para
// "Deferida / Deferido" (já era o valor dos produtos existentes e das conferências
// automáticas); os demais valores são novos. Sem valor = ainda não verificado.
export type CpStatus = "POSSUI" | "INDEFERIDO" | "EM_EXIGENCIA" | "EM_ANALISE" | "PARA_ANALISE";

export const CP_STATUS_OPTIONS: { value: CpStatus; label: string }[] = [
  { value: "POSSUI", label: "Deferida / Deferido" },
  { value: "INDEFERIDO", label: "Indeferido" },
  { value: "EM_EXIGENCIA", label: "Em exigência" },
  { value: "EM_ANALISE", label: "Em análise" },
  { value: "PARA_ANALISE", label: "Para análise" },
];

// Situações em que a CP está andando (ainda sem resultado final).
export const CP_IN_PROGRESS_STATUSES: readonly string[] = ["EM_EXIGENCIA", "EM_ANALISE", "PARA_ANALISE"];

export function cpStatusLabel(status: string | null | undefined): string | null {
  return CP_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? null;
}

export type ProductFlowInput = {
  description: string | null;
  sku: string | null;
  manufacturerSku: string | null;
  ncm: string | null;
  defaultSupplierId: string | null;
  photoUrl: string | null;
  cpStatus: string | null;
  cpListResult: string | null;
};

// Itens que faltam pro cadastro ser considerado completo.
export function missingRegistrationItems(p: ProductFlowInput): string[] {
  const missing: string[] = [];
  if (!p.description?.trim()) missing.push("nome");
  if (!p.sku?.trim()) missing.push("SKU interno");
  if (!p.manufacturerSku?.trim()) missing.push("SKU do fabricante");
  if (!p.ncm?.trim()) missing.push("NCM");
  if (!p.defaultSupplierId) missing.push("fornecedor padrão");
  if (!p.photoUrl) missing.push("foto");
  return missing;
}

// A CP conta como resolvida quando o usuário marcou "deferida" ou quando a
// varredura da lista pública do governo achou o produto como deferido.
export function hasPublicConsultation(p: Pick<ProductFlowInput, "cpStatus" | "cpListResult">): boolean {
  return p.cpStatus === "POSSUI" || p.cpListResult === "FOUND";
}
