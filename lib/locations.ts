// Portos/aeroportos conhecidos — extraído da aba "Tipo de Embarques" e dos
// destinos usados na aba "Fluxo de Importação" de FLUXOGRAMA DE
// IMPORTAÇÃO.xlsx. Lista fixa no código (mesmo padrão de INCOTERMS em
// SupplierForm.tsx) em vez de mais uma tabela/cadastro — se um destino não
// estiver na lista, o form ainda aceita texto livre.
export const LOCATIONS = [
  { code: "GRU", city: "Guarulhos", state: "SP" },
  { code: "BRSSZ", city: "Santos", state: "SP" },
  { code: "BRITJ", city: "Itajaí", state: "SC" },
  { code: "BRNVT", city: "Navegantes (Portonave)", state: "SC" },
  { code: "BRIOA", city: "Itapoá", state: "SC" },
  { code: "BRSFS", city: "São Francisco do Sul", state: "SC" },
  { code: "BRPEC", city: "Pecém", state: "CE" },
] as const;

export function locationLabel(code: string, city: string, state: string): string {
  return `${code} - ${city} (${state})`;
}
