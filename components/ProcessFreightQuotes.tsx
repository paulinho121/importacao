"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  saveFreightQuote,
  deleteFreightQuote,
  selectFreightQuote,
  clearFreightQuoteSelection,
} from "@/app/processos/freight-quotes-actions";
import { MODAIS } from "@/lib/modais";
import { INCOTERMS } from "@/lib/incoterms";
import { formatDate } from "@/lib/status";
import {
  formatMoney,
  quoteLines,
  quoteTotalBRL,
  quoteTotalsByCurrency,
  type QuoteAmounts,
} from "@/lib/freight-quotes";

export type FreightQuoteRow = QuoteAmounts & {
  id: string;
  agentId: string | null;
  agentName: string | null;
  proposal: string | null;
  modal: string | null;
  incoterm: string | null;
  carrier: string | null;
  origin: string | null;
  destination: string | null;
  transitDays: number | null;
  validUntil: string | null;
  // Dias que faltam para a validade (negativo = vencida), calculado no servidor.
  validityDaysLeft: number | null;
  otherFeesLabel: string | null;
  notes: string | null;
  isSelected: boolean;
};

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD" },
  { value: "BRL", label: "BRL" },
  { value: "EUR", label: "EUR" },
  { value: "CNY", label: "CNY" },
  { value: "GBP", label: "GBP" },
  { value: "JPY", label: "JPY" },
  { value: "OTHER", label: "Outra" },
];

const MODAL_LABEL = Object.fromEntries(MODAIS.filter((m) => m.value).map((m) => [m.value, m.label]));

const inputClass =
  "w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all";
const labelClass = "block font-label-md text-label-md text-on-surface-variant mb-1.5";

function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all disabled:opacity-60"
    >
      {pending ? "Salvando…" : children}
    </button>
  );
}

function CostRow({
  label,
  name,
  currencyName,
  defaultValue,
  defaultCurrency,
  extra,
}: {
  label: string;
  name: string;
  currencyName: string;
  defaultValue: string | null;
  defaultCurrency: string;
  extra?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[170px_1fr_90px] items-end gap-2">
      <div className="col-span-2 sm:col-span-1 sm:pb-2.5 font-label-md text-label-md text-on-surface-variant">
        {label}
        {extra}
      </div>
      <input
        className={`${inputClass} font-mono-data`}
        type="number"
        step="0.01"
        min="0"
        inputMode="decimal"
        name={name}
        placeholder="0,00"
        defaultValue={defaultValue ?? ""}
        aria-label={`${label} — valor`}
      />
      <select
        name={currencyName}
        defaultValue={defaultCurrency}
        aria-label={`${label} — moeda`}
        className={`${inputClass} appearance-none`}
      >
        {CURRENCY_OPTIONS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function QuoteForm({
  processId,
  quote,
  agents,
  defaults,
  onCancel,
}: {
  processId: string;
  quote: FreightQuoteRow | null;
  agents: { id: string; name: string }[];
  defaults: { modal: string | null; incoterm: string | null; destination: string | null };
  onCancel: () => void;
}) {
  const action = saveFreightQuote.bind(null, processId, quote?.id ?? null);
  return (
    <form
      action={action}
      className="border border-outline-variant rounded-xl p-4 bg-surface-container-low/40 space-y-4 mb-stack-md"
    >
      <h4 className="font-label-md text-label-md text-primary">
        {quote ? "Editar cotação" : "Nova cotação de frete"}
      </h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2">
          <label className={labelClass}>Agente de carga *</label>
          <select
            name="agentId"
            required
            defaultValue={quote?.agentId ?? ""}
            className={`${inputClass} appearance-none`}
          >
            <option value="">Selecione o agente</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Proposta / cotação nº</label>
          <input className={inputClass} name="proposal" defaultValue={quote?.proposal ?? ""} placeholder="Ex: Cotação 6903" />
        </div>
        <div>
          <label className={labelClass}>Validade da proposta</label>
          <input className={inputClass} type="date" name="validUntil" defaultValue={quote?.validUntil ?? ""} />
        </div>
        <div>
          <label className={labelClass}>Modal</label>
          <select
            name="modal"
            defaultValue={quote ? (quote.modal ?? "") : (defaults.modal ?? "")}
            className={`${inputClass} appearance-none`}
          >
            {MODAIS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.value ? m.label : "—"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Incoterm</label>
          <select
            name="incoterm"
            defaultValue={quote ? (quote.incoterm ?? "") : (defaults.incoterm ?? "")}
            className={`${inputClass} appearance-none`}
          >
            <option value="">—</option>
            {INCOTERMS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Cia aérea / armador</label>
          <input className={inputClass} name="carrier" defaultValue={quote?.carrier ?? ""} placeholder="Ex: Qatar Airways" />
        </div>
        <div>
          <label className={labelClass}>Trânsito (dias)</label>
          <input
            className={`${inputClass} font-mono-data`}
            type="number"
            min="0"
            step="1"
            name="transitDays"
            defaultValue={quote?.transitDays ?? ""}
          />
        </div>
        <div>
          <label className={labelClass}>Origem</label>
          <input className={inputClass} name="origin" defaultValue={quote?.origin ?? ""} placeholder="Ex: HKG" />
        </div>
        <div>
          <label className={labelClass}>Destino</label>
          <input
            className={inputClass}
            name="destination"
            defaultValue={quote ? (quote.destination ?? "") : (defaults.destination ?? "")}
            placeholder="Ex: GRU"
          />
        </div>
      </div>

      <div className="space-y-2 max-w-2xl">
        <CostRow
          label="Frete"
          name="freightValue"
          currencyName="freightCurrency"
          defaultValue={quote?.freightValue ?? null}
          defaultCurrency={quote?.freightCurrency ?? "USD"}
        />
        <CostRow
          label="Taxas de origem"
          name="originFeesValue"
          currencyName="originFeesCurrency"
          defaultValue={quote?.originFeesValue ?? null}
          defaultCurrency={quote?.originFeesCurrency ?? "USD"}
        />
        <CostRow
          label="Taxas de destino"
          name="destinationFeesValue"
          currencyName="destinationFeesCurrency"
          defaultValue={quote?.destinationFeesValue ?? null}
          defaultCurrency={quote?.destinationFeesCurrency ?? "BRL"}
        />
        <CostRow
          label="Outras taxas / custo adicional"
          name="otherFeesValue"
          currencyName="otherFeesCurrency"
          defaultValue={quote?.otherFeesValue ?? null}
          defaultCurrency={quote?.otherFeesCurrency ?? "BRL"}
          extra={
            <input
              className={`${inputClass} mt-1.5 font-normal`}
              name="otherFeesLabel"
              defaultValue={quote?.otherFeesLabel ?? ""}
              placeholder="Qual? Ex: DTA, seguro, handling"
              aria-label="Descrição das outras taxas"
            />
          }
        />
        <p className="text-xs text-on-surface-variant">
          Cada valor tem a sua moeda (ex.: frete em USD e taxa de destino em BRL). Deixe em branco o que não vier na
          cotação.
        </p>
      </div>

      <div>
        <label className={labelClass}>Observações</label>
        <textarea
          className={inputClass}
          name="notes"
          rows={2}
          defaultValue={quote?.notes ?? ""}
          placeholder="Ex: coleta inclusa, desconto, condição de pagamento…"
        />
      </div>

      <div className="flex gap-2">
        <SubmitButton>{quote ? "Salvar alterações" : "Adicionar cotação"}</SubmitButton>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant font-label-md text-label-md hover:bg-surface-container-high transition-all"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function ProcessFreightQuotes({
  processId,
  quotes,
  agents,
  processCurrency,
  exchangeRate,
  defaults,
  closed,
}: {
  processId: string;
  quotes: FreightQuoteRow[];
  agents: { id: string; name: string }[];
  processCurrency: string | null;
  exchangeRate: number | null;
  defaults: { modal: string | null; incoterm: string | null; destination: string | null };
  closed: boolean;
}) {
  // "new" = formulário de nova cotação; id = editando aquela cotação.
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const editingQuote = editing && editing !== "new" ? (quotes.find((q) => q.id === editing) ?? null) : null;

  const totalsBRL = quotes.map((q) => quoteTotalBRL(q, processCurrency, exchangeRate));
  const comparable = totalsBRL.filter((v): v is number => v !== null);
  const cheapest = comparable.length >= 2 ? Math.min(...comparable) : null;

  const rowLabel = "py-2 pr-3 text-left align-top font-label-md text-label-md text-on-surface-variant whitespace-nowrap";
  const cell = "py-2 px-3 align-top border-l border-outline-variant/60 min-w-[190px]";

  return (
    <section className="bg-surface-container-lowest border border-outline-variant p-gutter rounded-xl shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-stack-md">
        <div>
          <h3 className="font-headline-sm text-headline-sm text-primary">Cotações de Frete</h3>
          <p className="text-xs text-on-surface-variant">
            Registre a proposta de cada agente de carga e compare. Ao escolher uma, o agente e o frete (+ taxas de
            origem) vão para o processo.
          </p>
        </div>
        {!closed && editing === null && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="px-4 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all"
          >
            + Adicionar cotação
          </button>
        )}
      </div>

      {editing !== null && (editing === "new" || editingQuote) && (
        <QuoteForm
          key={editing}
          processId={processId}
          quote={editingQuote}
          agents={agents}
          defaults={defaults}
          onCancel={() => setEditing(null)}
        />
      )}

      {quotes.length === 0 ? (
        <p className="text-on-surface-variant font-body-sm text-body-sm">
          Nenhuma cotação registrada ainda.{" "}
          {agents.length === 0 && "Cadastre um agente de carga em Agentes antes de adicionar."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-body-sm font-body-sm">
            <tbody>
              <tr>
                <th className={rowLabel} />
                {quotes.map((q) => (
                  <td key={q.id} className={`${cell} ${q.isSelected ? "bg-tertiary-fixed/30" : ""}`}>
                    <p className="font-bold text-primary">{q.agentName ?? "Agente removido"}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {q.isSelected && (
                        <span className="px-2 py-0.5 rounded-full bg-secondary text-white text-[11px] font-bold">
                          Escolhida
                        </span>
                      )}
                      {cheapest !== null && totalsBRL[quotes.indexOf(q)] === cheapest && (
                        <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant text-[11px] font-bold">
                          Menor custo
                        </span>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
              <Row label="Proposta" quotes={quotes} cell={cell} rowLabel={rowLabel} render={(q) => q.proposal ?? "—"} />
              <Row
                label="Modal / Cia"
                quotes={quotes}
                cell={cell}
                rowLabel={rowLabel}
                render={(q) =>
                  [q.modal ? MODAL_LABEL[q.modal] : null, q.carrier, q.incoterm].filter(Boolean).join(" · ") || "—"
                }
              />
              <Row
                label="Rota"
                quotes={quotes}
                cell={cell}
                rowLabel={rowLabel}
                render={(q) => (q.origin || q.destination ? `${q.origin ?? "?"} → ${q.destination ?? "?"}` : "—")}
              />
              <Row
                label="Trânsito"
                quotes={quotes}
                cell={cell}
                rowLabel={rowLabel}
                render={(q) => (q.transitDays !== null ? `${q.transitDays} dias` : "—")}
              />
              <Row
                label="Validade"
                quotes={quotes}
                cell={cell}
                rowLabel={rowLabel}
                render={(q) =>
                  q.validUntil ? (
                    <span className={q.validityDaysLeft !== null && q.validityDaysLeft < 0 ? "text-error font-semibold" : ""}>
                      {formatDate(q.validUntil)}
                      {q.validityDaysLeft !== null && q.validityDaysLeft < 0 ? " (vencida)" : ""}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <MoneyRow label="Frete" lineKey="freight" quotes={quotes} cell={cell} rowLabel={rowLabel} />
              <MoneyRow label="Taxas de origem" lineKey="origin" quotes={quotes} cell={cell} rowLabel={rowLabel} />
              <MoneyRow label="Taxas de destino" lineKey="destination" quotes={quotes} cell={cell} rowLabel={rowLabel} />
              <MoneyRow
                label="Outras taxas"
                lineKey="other"
                quotes={quotes}
                cell={cell}
                rowLabel={rowLabel}
                sub={(q) => q.otherFeesLabel}
              />
              <tr className="border-t-2 border-outline-variant">
                <th className={`${rowLabel} text-primary`}>Total</th>
                {quotes.map((q, i) => {
                  const totals = quoteTotalsByCurrency(q);
                  const brl = totalsBRL[i];
                  const mixed = totals.some((t) => t.currency !== "BRL");
                  return (
                    <td key={q.id} className={`${cell} ${q.isSelected ? "bg-tertiary-fixed/30" : ""}`}>
                      {totals.length === 0 ? (
                        "—"
                      ) : (
                        <>
                          {totals.map((t) => (
                            <p key={t.currency} className="font-mono-data font-bold text-primary">
                              {formatMoney(t.value, t.currency)}
                            </p>
                          ))}
                          {mixed && brl !== null && (
                            <p className="font-mono-data text-xs text-on-surface-variant mt-0.5">
                              ≈ {formatMoney(brl, "BRL")}
                            </p>
                          )}
                          {mixed && brl === null && (
                            <p className="text-[11px] text-outline mt-0.5">
                              {exchangeRate ? "Moedas diferentes — sem conversão" : "Busque o câmbio para somar em R$"}
                            </p>
                          )}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
              <Row
                label="Observações"
                quotes={quotes}
                cell={cell}
                rowLabel={rowLabel}
                render={(q) => (q.notes ? <span className="whitespace-pre-wrap">{q.notes}</span> : "—")}
              />
              {!closed && (
                <tr>
                  <th className={rowLabel} />
                  {quotes.map((q) => (
                    <td key={q.id} className={`${cell} ${q.isSelected ? "bg-tertiary-fixed/30" : ""}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        {q.isSelected ? (
                          <form action={clearFreightQuoteSelection.bind(null, processId)}>
                            <button
                              type="submit"
                              className="px-3 py-1.5 rounded-lg border border-outline text-primary text-xs font-bold hover:bg-surface-container-high transition-all"
                            >
                              Desmarcar
                            </button>
                          </form>
                        ) : (
                          <form action={selectFreightQuote.bind(null, q.id, processId)}>
                            <button
                              type="submit"
                              className="px-3 py-1.5 rounded-lg bg-secondary text-white text-xs font-bold hover:opacity-90 transition-all"
                            >
                              Escolher
                            </button>
                          </form>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditing(q.id)}
                          className="px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface-variant text-xs font-bold hover:bg-surface-container-high transition-all"
                        >
                          Editar
                        </button>
                        <form
                          action={deleteFreightQuote.bind(null, q.id, processId)}
                          onSubmit={(e) => {
                            if (!window.confirm(`Remover a cotação de ${q.agentName ?? "este agente"}?`)) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <button
                            type="submit"
                            className="px-3 py-1.5 rounded-lg text-error text-xs font-bold hover:bg-error-container/30 transition-all"
                          >
                            Remover
                          </button>
                        </form>
                      </div>
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Row({
  label,
  quotes,
  cell,
  rowLabel,
  render,
}: {
  label: string;
  quotes: FreightQuoteRow[];
  cell: string;
  rowLabel: string;
  render: (q: FreightQuoteRow) => ReactNode;
}) {
  return (
    <tr>
      <th className={rowLabel}>{label}</th>
      {quotes.map((q) => (
        <td key={q.id} className={`${cell} ${q.isSelected ? "bg-tertiary-fixed/30" : ""}`}>
          {render(q)}
        </td>
      ))}
    </tr>
  );
}

function MoneyRow({
  label,
  lineKey,
  quotes,
  cell,
  rowLabel,
  sub,
}: {
  label: string;
  lineKey: "freight" | "origin" | "destination" | "other";
  quotes: FreightQuoteRow[];
  cell: string;
  rowLabel: string;
  sub?: (q: FreightQuoteRow) => string | null;
}) {
  return (
    <Row
      label={label}
      quotes={quotes}
      cell={cell}
      rowLabel={rowLabel}
      render={(q) => {
        const line = quoteLines(q).find((l) => l.key === lineKey)!;
        if (!line.filled) return "—";
        const s = sub?.(q);
        return (
          <>
            <span className="font-mono-data">{formatMoney(line.value, line.currency)}</span>
            {s && <span className="block text-xs text-on-surface-variant">{s}</span>}
          </>
        );
      }}
    />
  );
}
