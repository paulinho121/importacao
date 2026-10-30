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
  { code: "VCP", city: "Viracopos - Campinas", state: "SP" },
  // Entrega direta na filial (courier/consolidado que não passa pelo
  // armazém do porto/aeroporto) — a planilha do time usa "🚚 MCI Filial
  // SP/SC" na mesma coluna de destino.
  { code: "FIL-SP", city: "MCI Filial SP", state: "SP" },
  { code: "FIL-SC", city: "MCI Filial SC", state: "SC" },
] as const;

export function locationLabel(code: string, city: string, state: string): string {
  if (code.startsWith("FIL-")) return city;
  return `${code} - ${city} (${state})`;
}
