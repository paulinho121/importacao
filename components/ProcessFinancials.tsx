"use client";

import { useActionState } from "react";
import {
  updateProcessFinancials,
  updateProcessInvoiceValue,
  fetchExchangeRateAction,
  type FetchExchangeRateState,
} from "@/app/processos/actions";
import { INCOTERMS } from "@/lib/incoterms";
import { CURRENCIES } from "@/lib/currencies";
import { formatDate } from "@/lib/status";
import { calcValorAduaneiro } from "@/lib/landed-cost";

export type ProcessFinancialsData = {
  currency: string | null;
  incoterm: string | null;
  internationalFreightValue: string | null;
  insuranceValue: string | null;
  exchangeRate: string | null;
  exchangeRateDate: string | null;
};

export type ProcessInvoiceData = {
  id: string;
  invoiceNumber: string;
  value: string | null;
};

export default function ProcessFinancials({
  processId,
  etaEstimated,
  financials,
  invoices,
}: {
  processId: string;
  etaEstimated: string | null;
  financials: ProcessFinancialsData;
  invoices: ProcessInvoiceData[];
}) {
  const boundUpdateFinancials = updateProcessFinancials.bind(null, processId);
  const boundFetchRate = fetchExchangeRateAction.bind(null, processId);
  const [state, fetchRateAction, isPending] = useActionState<FetchExchangeRateState, FormData>(
    boundFetchRate,
    null,
  );

  const totalInvoicesValue = invoices.reduce((sum, inv) => sum + Number(inv.value ?? 0), 0);
  const freight = Number(financials.internationalFreightValue ?? 0);
  const insurance = Number(financials.insuranceValue ?? 0);
  const totalForeign = totalInvoicesValue + freight + insurance;
  const rate = financials.exchangeRate ? Number(financials.exchangeRate) : null;
  const totalBRL =
    rate !== null
      ? calcValorAduaneiro({ invoicesSum: totalInvoicesValue, freight, insurance, rate })
      : null;
  const currencyLabel = financials.currency ?? "";

  return (
    <section className="bg-white border border-outline-variant p-gutter rounded-xl shadow-sm">
      <h3 className="font-headline-sm text-headline-sm text-primary mb-stack-md">
        Dados Financeiros
      </h3>

      <form action={boundUpdateFinancials} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-1.5">
              Moeda
            </label>
            <select
              name="currency"
              defaultValue={financials.currency ?? ""}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all appearance-none"
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-1.5">
              Incoterm
            </label>
            <select
              name="incoterm"
              defaultValue={financials.incoterm ?? ""}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all appearance-none"
            >
              <option value="">Selecione o Incoterm</option>
              {INCOTERMS.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-1.5">
              Frete Internacional
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm font-mono-data focus:outline-none focus:border-secondary transition-all"
              type="number"
              step="0.01"
              name="internationalFreightValue"
              defaultValue={financials.internationalFreightValue ?? ""}
            />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-1.5">
              Seguro Internacional
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm font-mono-data focus:outline-none focus:border-secondary transition-all"
              type="number"
              step="0.01"
              name="insuranceValue"
              defaultValue={financials.insuranceValue ?? ""}
            />
          </div>
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg border border-outline text-primary font-label-md text-label-md hover:bg-surface-container-high transition-all"
        >
          Salvar Dados Financeiros
        </button>
      </form>

      <div className="mt-4 pt-4 border-t border-outline-variant">
        <span className="font-label-md text-label-md text-outline block mb-2">
          Valor das Invoices {currencyLabel ? `(${currencyLabel})` : ""}
        </span>
        {invoices.length === 0 ? (
          <p className="text-on-surface-variant font-body-sm text-body-sm">
            Nenhuma invoice registrada ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {invoices.map((inv) => {
              const boundUpdateValue = updateProcessInvoiceValue.bind(null, inv.id, processId);
              return (
                <li key={inv.id} className="flex items-center gap-2">
                  <span
                    className="font-mono-data text-xs w-28 shrink-0 truncate"
                    title={inv.invoiceNumber}
                  >
                    {inv.invoiceNumber}
                  </span>
                  <form action={boundUpdateValue} className="flex flex-1 gap-2">
                    <input
                      className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs font-mono-data focus:outline-none focus:border-secondary transition-all"
                      type="number"
                      step="0.01"
                      name="value"
                      placeholder="Valor FOB"
                      defaultValue={inv.value ?? ""}
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 rounded-lg border border-outline text-primary text-xs font-bold hover:bg-surface-container-high transition-all"
                    >
                      Salvar
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-outline-variant">
        <span className="font-label-md text-label-md text-outline block mb-2">
          Câmbio (PTAX Bacen — cotação de venda)
        </span>
        <form action={fetchRateAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="currency" value={financials.currency ?? ""} />
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-on-surface-variant mb-1">Data de referência</label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
              type="date"
              name="exchangeRateDate"
              defaultValue={financials.exchangeRateDate ?? etaEstimated ?? ""}
            />
          </div>
          <button
            type="submit"
            disabled={isPending || !financials.currency || financials.currency === "OTHER"}
            className="px-4 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all disabled:opacity-50"
          >
            {isPending ? "Buscando..." : "Buscar câmbio"}
          </button>
        </form>
        {financials.currency === "OTHER" && (
          <p className="text-xs text-on-surface-variant mt-2">
            Moeda &ldquo;Outra&rdquo; não tem busca automática — salve o câmbio manualmente
            editando o processo (campo fora desta tela por ora).
          </p>
        )}
        {state?.error && (
          <p className="text-xs text-error font-medium bg-error-container/20 border border-error-container/50 rounded-lg p-2 mt-2">
            {state.error}
          </p>
        )}
        {rate !== null && financials.exchangeRateDate && (
          <p className="text-xs text-on-surface-variant mt-2">
            Câmbio salvo: <span className="font-mono-data text-on-surface">{rate.toFixed(4)}</span>{" "}
            em {formatDate(financials.exchangeRateDate)}
          </p>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-outline-variant bg-surface-container-lowest rounded-lg p-4">
        <span className="font-label-md text-label-md text-outline block mb-2">
          Valor Aduaneiro (estimado)
        </span>
        <p className="text-body-md font-body-md text-on-surface">
          {totalForeign > 0 ? `${totalForeign.toFixed(2)} ${currencyLabel}` : "—"}
          {totalBRL !== null && (
            <span className="block text-headline-sm font-headline-sm text-primary mt-1">
              ≈ R${" "}
              {totalBRL.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          )}
        </p>
        <p className="text-xs text-on-surface-variant mt-2">
          Soma das invoices + frete + seguro, convertida pelo câmbio salvo. Estimativa
          operacional — não substitui a valoração aduaneira oficial da DUIMP/despachante.
        </p>
      </div>
    </section>
  );
}
