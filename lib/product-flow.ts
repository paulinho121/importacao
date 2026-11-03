// Fluxo do produto, em 3 etapas:
//  1. Cadastro completo (com foto)
//  2. Consulta Pública (CP): conferir se já existe; se não, solicitar e acompanhar
//  3. Benefício (LPCO) pedido para o estado do pedido (SP/SC/CE), válido por
//     LPCO_REUSE_DAYS dias — com contagem do tempo que falta (lib/lpco.ts)

export type CpStatus = "NAO_VERIFICADO" | "POSSUI" | "NAO_POSSUI" | "SOLICITADA";

export const CP_STATUS_OPTIONS: { value: CpStatus; label: string }[] = [
  { value: "NAO_VERIFICADO", label: "Ainda não verificado" },
  { value: "POSSUI", label: "Já possui consulta pública" },
  { value: "NAO_POSSUI", label: "Não possui — precisa solicitar" },
  { value: "SOLICITADA", label: "Solicitada — em acompanhamento" },
];

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

// A CP conta como resolvida quando o usuário marcou "já possui" ou quando a
// varredura da lista pública do governo achou o produto como deferido.
export function hasPublicConsultation(p: Pick<ProductFlowInput, "cpStatus" | "cpListResult">): boolean {
  return p.cpStatus === "POSSUI" || p.cpListResult === "FOUND";
}
