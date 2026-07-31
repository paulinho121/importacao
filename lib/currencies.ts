// Opções de moeda usadas tanto nos dados financeiros do processo (câmbio
// PTAX) quanto no custo de compra do produto — mesmo enum currencyEnum do
// schema (db/schema.ts), uma única fonte de rótulos.
export const CURRENCIES = [
  { value: "", label: "Selecione" },
  { value: "USD", label: "USD - Dólar americano" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "CNY", label: "CNY - Yuan chinês" },
  { value: "GBP", label: "GBP - Libra esterlina" },
  { value: "JPY", label: "JPY - Iene japonês" },
  { value: "OTHER", label: "Outra" },
];
