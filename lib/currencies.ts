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

// Só pra contas a pagar (process_payables) — desembaraço/armazenagem
// costumam já vir em reais, diferente do resto (sempre moeda estrangeira
// convertida por PTAX), por isso BRL não entra na lista genérica acima.
export const PAYABLE_CURRENCIES = [
  { value: "BRL", label: "BRL - Real" },
  ...CURRENCIES.slice(1),
];
