"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  saveFreightQuote,
  deleteFreightQuote,
  selectFreightQuote,
  clearFreightQuoteSelection,
} from "@/app/processos/freight-quotes-actions";
import DocumentViewer from "@/components/DocumentViewer";
import { MODAIS } from "@/lib/modais";
import { INCOTERMS } from "@/lib/incoterms";
import { formatDate } from "@/lib/status";
import {
  QUOTE_SECTIONS,
  QUOTE_UNITS,
  computeLineTotal,
  formatMoney,
  quoteUnitLabel,
  totalBRL,
  totalsByCurrency,
  transitLabel,
  type QuoteSection,
} from "@/lib/freight-quotes";

export type FreightQuoteLineRow = {
  id: string;
  section: QuoteSection;
  description: string;
  quantity: string | null;
  unitPrice: string | null;
  unit: string | null;
  minimum: string | null;
  currency: string;
  total: string;
};

export type FreightQuoteRow = {
  id: string;
  agentId: string | null;
  agentName: string | null;
  proposal: string | null;
  quoteDate: string | null;
  validUntil: string | null;
  // Dias que faltam para a validade (negativo = vencida), calculado no servidor.
  validityDaysLeft: number | null;
  modal: string | null;
  incoterm: string | null;
  carrier: string | null;
  origin: string | null;
  destination: string | null;
  route: string | null;
  transitDays: number | null;
  transitDaysMax: number | null;
  frequency: string | null;
  cargoDescription: string | null;
  grossWeightKg: string | null;
  volumes: number | null;
  volumeM3: string | null;
  dimensions: string | null;
  cargoValue: string | null;
  cargoValueCurrency: string | null;
  pickupAddress: string | null;
  notes: string | null;
  fileName: string | null;
  isSelected: boolean;
  lines: FreightQuoteLineRow[];
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
const MAX_FILE_BYTES = 4 * 1024 * 1024;

const inputClass =
  "w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all";
const smallInputClass =
  "w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all";
const labelClass = "block font-label-md text-label-md text-on-surface-variant mb-1.5";
const miniLabel = "block text-[11px] text-on-surface-variant mb-0.5";

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

// ---------- formulário ----------

type LineState = {
  key: string;
  section: QuoteSection;
  description: string;
  quantity: string;
  unitPrice: string;
  unit: string;
  minimum: string;
  currency: string;
  total: string;
  // true quando o total foi digitado à mão (ou veio da proposta): deixa de
  // ser recalculado por quantidade × tarifa.
  totalTouched: boolean;
};

let keySeq = 0;
const nextKey = () => `l${++keySeq}`;

function toNumber(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function emptyLine(section: QuoteSection, currency?: string): LineState {
  const def = QUOTE_SECTIONS.find((s) => s.value === section)!;
  return {
    key: nextKey(),
    section,
    description: "",
    quantity: "",
    unitPrice: "",
    unit: "",
    minimum: "",
    currency: currency ?? def.defaultCurrency,
    total: "",
    totalTouched: false,
  };
}

function initialLines(quote: FreightQuoteRow | null): LineState[] {
  if (!quote) return [emptyLine("FRETE")];
  return quote.lines.map((l) => ({
    key: nextKey(),
    section: l.section,
    description: l.description,
    quantity: l.quantity ? String(Number(l.quantity)) : "",
    unitPrice: l.unitPrice ? String(Number(l.unitPrice)) : "",
    unit: l.unit ?? "",
    minimum: l.minimum && Number(l.minimum) > 0 ? String(Number(l.minimum)) : "",
    currency: l.currency,
    total: l.total,
    totalTouched: true,
  }));
}

function LinesEditor({
  lines,
  setLines,
}: {
  lines: LineState[];
  setLines: (fn: (prev: LineState[]) => LineState[]) => void;
}) {
  function update(key: string, patch: Partial<LineState>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        if ("total" in patch) next.totalTouched = patch.total !== "";
        const affectsTotal = "quantity" in patch || "unitPrice" in patch || "minimum" in patch;
        if (affectsTotal && !next.totalTouched) {
          const t = computeLineTotal(toNumber(next.quantity), toNumber(next.unitPrice), toNumber(next.minimum));
          next.total = t === null ? "" : String(t);
        }
        return next;
      }),
    );
  }

  return (
    <div className="space-y-4">
      {QUOTE_SECTIONS.map((section) => {
        const sectionLines = lines.filter((l) => l.section === section.value);
        const subtotal = totalsByCurrency(
          sectionLines.map((l) => ({ section: l.section, currency: l.currency, total: toNumber(l.total) ?? 0 })),
        );
        const listId = `sugestoes-${section.value}`;
        return (
          <div key={section.value} className="border border-outline-variant rounded-lg p-3 bg-surface-container-lowest">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
              <div>
                <h5 className="font-label-md text-label-md text-primary">{section.label}</h5>
                <p className="text-[11px] text-on-surface-variant">{section.hint}</p>
              </div>
              {subtotal.length > 0 && (
                <span className="font-mono-data text-xs text-on-surface-variant">
                  {subtotal.map((t) => formatMoney(t.value, t.currency)).join(" + ")}
                </span>
              )}
            </div>
            <datalist id={listId}>
              {section.suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>

            <div className="space-y-2">
              {sectionLines.map((l) => (
                <div
                  key={l.key}
                  className="grid grid-cols-2 sm:grid-cols-6 lg:grid-cols-[minmax(0,2fr)_80px_90px_110px_80px_80px_110px_auto] gap-2 items-end border-t border-outline-variant/50 pt-2 first:border-t-0 first:pt-0"
                >
                  <input type="hidden" name="lineSection" value={l.section} />
                  <label className="col-span-2 sm:col-span-6 lg:col-span-1">
                    <span className={miniLabel}>Descrição</span>
                    <input
                      className={smallInputClass}
                      name="lineDescription"
                      list={listId}
                      value={l.description}
                      onChange={(e) => update(l.key, { description: e.target.value })}
                      placeholder="Ex: Airport transfer"
                    />
                  </label>
                  <label>
                    <span className={miniLabel}>Qtde</span>
                    <input
                      className={`${smallInputClass} font-mono-data`}
                      name="lineQuantity"
                      type="number"
                      step="any"
                      min="0"
                      inputMode="decimal"
                      value={l.quantity}
                      onChange={(e) => update(l.key, { quantity: e.target.value })}
                    />
                  </label>
                  <label>
                    <span className={miniLabel}>Tarifa</span>
                    <input
                      className={`${smallInputClass} font-mono-data`}
                      name="lineUnitPrice"
                      type="number"
                      step="any"
                      min="0"
                      inputMode="decimal"
                      value={l.unitPrice}
                      onChange={(e) => update(l.key, { unitPrice: e.target.value })}
                    />
                  </label>
                  <label>
                    <span className={miniLabel}>Unidade</span>
                    <select
                      className={`${smallInputClass} appearance-none`}
                      name="lineUnit"
                      value={l.unit}
                      onChange={(e) => update(l.key, { unit: e.target.value })}
                    >
                      {QUOTE_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className={miniLabel}>Mínimo</span>
                    <input
                      className={`${smallInputClass} font-mono-data`}
                      name="lineMinimum"
                      type="number"
                      step="any"
                      min="0"
                      inputMode="decimal"
                      value={l.minimum}
                      onChange={(e) => update(l.key, { minimum: e.target.value })}
                    />
                  </label>
                  <label>
                    <span className={miniLabel}>Moeda</span>
                    <select
                      className={`${smallInputClass} appearance-none`}
                      name="lineCurrency"
                      value={l.currency}
                      onChange={(e) => update(l.key, { currency: e.target.value })}
                    >
                      {CURRENCY_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className={miniLabel}>Total</span>
                    <input
                      className={`${smallInputClass} font-mono-data font-bold`}
                      name="lineTotal"
                      type="number"
                      step="any"
                      min="0"
                      inputMode="decimal"
                      value={l.total}
                      onChange={(e) => update(l.key, { total: e.target.value })}
                      placeholder="0,00"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                    aria-label={`Remover linha ${l.description || ""}`}
                    className="col-span-2 sm:col-span-1 px-2 py-2 rounded-lg text-error text-xs font-bold hover:bg-error-container/30 transition-all"
                  >
                    Remover
                  </button>
                </div>
              ))}
              {sectionLines.length === 0 && (
                <p className="text-xs text-on-surface-variant">Nenhuma linha nesta seção.</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                const last = sectionLines[sectionLines.length - 1];
                setLines((prev) => [...prev, emptyLine(section.value, last?.currency)]);
              }}
              className="mt-2 text-xs font-bold text-secondary hover:underline"
            >
              + Adicionar linha
            </button>
          </div>
        );
      })}
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
  const [lines, setLines] = useState<LineState[]>(() => initialLines(quote));
  const grand = totalsByCurrency(
    lines.map((l) => ({ section: l.section, currency: l.currency, total: toNumber(l.total) ?? 0 })),
  );

  return (
    <form
      action={action}
      className="border border-outline-variant rounded-xl p-4 bg-surface-container-low/40 space-y-5 mb-stack-md"
    >
      <h4 className="font-headline-sm text-headline-sm text-primary">
        {quote ? "Editar cotação" : "Nova cotação de frete"}
      </h4>

      <fieldset className="space-y-3">
        <legend className="font-label-md text-label-md text-primary mb-1">Proposta</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <label className={labelClass}>Agente de carga *</label>
            <select name="agentId" required defaultValue={quote?.agentId ?? ""} className={`${inputClass} appearance-none`}>
              <option value="">Selecione o agente</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Referência da cotação</label>
            <input className={inputClass} name="proposal" defaultValue={quote?.proposal ?? ""} placeholder="Ex: RKT-014949-26" />
          </div>
          <div>
            <label className={labelClass}>Data da cotação</label>
            <input className={inputClass} type="date" name="quoteDate" defaultValue={quote?.quoteDate ?? ""} />
          </div>
          <div>
            <label className={labelClass}>Validade para embarque</label>
            <input className={inputClass} type="date" name="validUntil" defaultValue={quote?.validUntil ?? ""} />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-label-md text-label-md text-primary mb-1">Embarque</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <label className={labelClass}>Cia aérea / armador</label>
            <input className={inputClass} name="carrier" defaultValue={quote?.carrier ?? ""} placeholder="Ex: KLM" />
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
            <label className={labelClass}>Frequência</label>
            <input className={inputClass} name="frequency" defaultValue={quote?.frequency ?? ""} placeholder="Ex: 5 x por semana" />
          </div>
          <div>
            <label className={labelClass}>Origem</label>
            <input className={inputClass} name="origin" defaultValue={quote?.origin ?? ""} placeholder="Ex: Beijing International Airport" />
          </div>
          <div>
            <label className={labelClass}>Destino</label>
            <input
              className={inputClass}
              name="destination"
              defaultValue={quote ? (quote.destination ?? "") : (defaults.destination ?? "")}
              placeholder="Ex: Guarulhos"
            />
          </div>
          <div>
            <label className={labelClass}>Rota</label>
            <input className={inputClass} name="route" defaultValue={quote?.route ?? ""} placeholder="Ex: PKE-CDG-GRU" />
          </div>
          <div>
            <label className={labelClass}>Trânsito (dias)</label>
            <div className="flex items-center gap-2">
              <input
                className={`${inputClass} font-mono-data`}
                type="number"
                min="0"
                step="1"
                name="transitDays"
                aria-label="Trânsito mínimo em dias"
                placeholder="de"
                defaultValue={quote?.transitDays ?? ""}
              />
              <span className="text-xs text-on-surface-variant">a</span>
              <input
                className={`${inputClass} font-mono-data`}
                type="number"
                min="0"
                step="1"
                name="transitDaysMax"
                aria-label="Trânsito máximo em dias"
                placeholder="até"
                defaultValue={quote?.transitDaysMax ?? ""}
              />
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-label-md text-label-md text-primary mb-1">Carga cotada</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>Mercadoria</label>
            <input className={inputClass} name="cargoDescription" defaultValue={quote?.cargoDescription ?? ""} placeholder="Ex: FAK" />
          </div>
          <div>
            <label className={labelClass}>Peso bruto (kg)</label>
            <input
              className={`${inputClass} font-mono-data`}
              type="number"
              step="any"
              min="0"
              name="grossWeightKg"
              defaultValue={quote?.grossWeightKg ? String(Number(quote.grossWeightKg)) : ""}
            />
          </div>
          <div>
            <label className={labelClass}>Volumes</label>
            <input
              className={`${inputClass} font-mono-data`}
              type="number"
              step="1"
              min="0"
              name="volumes"
              defaultValue={quote?.volumes ?? ""}
            />
          </div>
          <div>
            <label className={labelClass}>Volume (m³)</label>
            <input
              className={`${inputClass} font-mono-data`}
              type="number"
              step="any"
              min="0"
              name="volumeM3"
              defaultValue={quote?.volumeM3 ? String(Number(quote.volumeM3)) : ""}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Dimensões</label>
            <input
              className={inputClass}
              name="dimensions"
              defaultValue={quote?.dimensions ?? ""}
              placeholder="Ex: 1 volume · 120 × 83 × 90 cm"
            />
          </div>
          <div>
            <label className={labelClass}>Valor da mercadoria</label>
            <input
              className={`${inputClass} font-mono-data`}
              type="number"
              step="any"
              min="0"
              name="cargoValue"
              defaultValue={quote?.cargoValue ? String(Number(quote.cargoValue)) : ""}
            />
          </div>
          <div>
            <label className={labelClass}>Moeda do valor</label>
            <select
              name="cargoValueCurrency"
              defaultValue={quote?.cargoValueCurrency ?? "USD"}
              className={`${inputClass} appearance-none`}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className={labelClass}>Endereço de coleta</label>
            <input
              className={inputClass}
              name="pickupAddress"
              defaultValue={quote?.pickupAddress ?? ""}
              placeholder="Endereço do fornecedor onde a carga será coletada"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-label-md text-label-md text-primary mb-1">Valores da proposta</legend>
        <p className="text-xs text-on-surface-variant">
          Cada linha tem a sua moeda. O total sai de quantidade × tarifa (respeitando o mínimo), mas você pode
          digitar o total direto, como na proposta do agente. Só preencha o que vier na cotação.
        </p>
        <LinesEditor lines={lines} setLines={setLines} />
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-container-high px-3 py-2">
          <span className="font-label-md text-label-md text-primary">Resumo de despesas</span>
          <span className="font-mono-data font-bold text-primary">
            {grand.length === 0 ? "—" : grand.map((t) => formatMoney(t.value, t.currency)).join(" + ")}
          </span>
        </div>
      </fieldset>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Observações</label>
          <textarea
            className={inputClass}
            name="notes"
            rows={3}
            defaultValue={quote?.notes ?? ""}
            placeholder="Ex: coleta inclusa, condições, restrições da proposta…"
          />
        </div>
        <div>
          <label className={labelClass}>Arquivo da proposta (PDF, imagem ou planilha — até 4 MB)</label>
          <input
            type="file"
            name="file"
            accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && f.size > MAX_FILE_BYTES) {
                toast.error("O arquivo passa de 4 MB. Reduza ou comprima e escolha de novo.");
                e.target.value = "";
              }
            }}
            className="block w-full text-body-sm font-body-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
          />
          {quote?.fileName && (
            <label className="mt-2 flex items-center gap-2 text-xs text-on-surface-variant">
              <input type="checkbox" name="removeFile" value="1" />
              Remover o arquivo atual ({quote.fileName}) — ou escolha outro acima para substituir
            </label>
          )}
        </div>
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

// ---------- comparação ----------

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

  const totalsBRL = quotes.map((q) => (q.lines.length > 0 ? totalBRL(q.lines, processCurrency, exchangeRate) : null));
  const comparable = totalsBRL.filter((v): v is number => v !== null);
  const cheapest = comparable.length >= 2 ? Math.min(...comparable) : null;

  const rowLabel = "py-2 pr-3 text-left align-top font-label-md text-label-md text-on-surface-variant whitespace-nowrap";
  const cell = "py-2 px-3 align-top border-l border-outline-variant/60 min-w-[210px] max-w-[280px]";
  const sel = (q: FreightQuoteRow) => (q.isSelected ? "bg-tertiary-fixed/30" : "");

  return (
    <section className="bg-surface-container-lowest border border-outline-variant p-gutter rounded-xl shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-stack-md">
        <div>
          <h3 className="font-headline-sm text-headline-sm text-primary">Cotações de Frete</h3>
          <p className="text-xs text-on-surface-variant">
            Registre a proposta de cada agente de carga e compare. Ao escolher uma, o agente e o frete (+ despesas de
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
                {quotes.map((q, i) => (
                  <td key={q.id} className={`${cell} ${sel(q)}`}>
                    <p className="font-bold text-primary">{q.agentName ?? "Agente removido"}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {q.isSelected && (
                        <span className="px-2 py-0.5 rounded-full bg-secondary text-white text-[11px] font-bold">
                          Escolhida
                        </span>
                      )}
                      {cheapest !== null && totalsBRL[i] === cheapest && (
                        <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant text-[11px] font-bold">
                          Menor custo
                        </span>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
              <Row
                label="Referência"
                quotes={quotes}
                cell={cell}
                rowLabel={rowLabel}
                sel={sel}
                render={(q) => (
                  <>
                    {q.proposal ?? "—"}
                    {q.quoteDate && <span className="block text-xs text-on-surface-variant">em {formatDate(q.quoteDate)}</span>}
                  </>
                )}
              />
              <Row
                label="Validade p/ embarque"
                quotes={quotes}
                cell={cell}
                rowLabel={rowLabel}
                sel={sel}
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
              <Row
                label="Modal / Cia"
                quotes={quotes}
                cell={cell}
                rowLabel={rowLabel}
                sel={sel}
                render={(q) =>
                  [q.modal ? MODAL_LABEL[q.modal] : null, q.carrier, q.incoterm].filter(Boolean).join(" · ") || "—"
                }
              />
              <Row
                label="Rota"
                quotes={quotes}
                cell={cell}
                rowLabel={rowLabel}
                sel={sel}
                render={(q) => (
                  <>
                    {q.origin || q.destination ? `${q.origin ?? "?"} → ${q.destination ?? "?"}` : "—"}
                    {q.route && <span className="block text-xs text-on-surface-variant">{q.route}</span>}
                  </>
                )}
              />
              <Row
                label="Trânsito"
                quotes={quotes}
                cell={cell}
                rowLabel={rowLabel}
                sel={sel}
                render={(q) => (
                  <>
                    {transitLabel(q.transitDays, q.transitDaysMax)}
                    {q.frequency && <span className="block text-xs text-on-surface-variant">{q.frequency}</span>}
                  </>
                )}
              />
              <Row
                label="Carga"
                quotes={quotes}
                cell={cell}
                rowLabel={rowLabel}
                sel={sel}
                render={(q) => {
                  const parts = [
                    q.grossWeightKg ? `${Number(q.grossWeightKg).toLocaleString("pt-BR")} kg` : null,
                    q.volumes !== null ? `${q.volumes} vol.` : null,
                    q.volumeM3 ? `${Number(q.volumeM3).toLocaleString("pt-BR")} m³` : null,
                    q.cargoDescription,
                  ].filter(Boolean);
                  return (
                    <>
                      {parts.length > 0 ? parts.join(" · ") : "—"}
                      {q.dimensions && <span className="block text-xs text-on-surface-variant">{q.dimensions}</span>}
                      {q.cargoValue && (
                        <span className="block text-xs text-on-surface-variant">
                          Mercadoria: {formatMoney(Number(q.cargoValue), q.cargoValueCurrency ?? "USD")}
                        </span>
                      )}
                    </>
                  );
                }}
              />
              {QUOTE_SECTIONS.map((section) => (
                <Row
                  key={section.value}
                  label={section.value === "OUTRAS" ? "Outras taxas" : section.label}
                  quotes={quotes}
                  cell={cell}
                  rowLabel={rowLabel}
                  sel={sel}
                  render={(q) => {
                    const totals = totalsByCurrency(q.lines, section.value);
                    if (totals.length === 0) return "—";
                    return totals.map((t) => (
                      <p key={t.currency} className="font-mono-data">
                        {formatMoney(t.value, t.currency)}
                      </p>
                    ));
                  }}
                />
              ))}
              <tr className="border-t-2 border-outline-variant">
                <th className={`${rowLabel} text-primary`}>Total</th>
                {quotes.map((q, i) => {
                  const totals = totalsByCurrency(q.lines);
                  const brl = totalsBRL[i];
                  const mixed = totals.some((t) => t.currency !== "BRL");
                  return (
                    <td key={q.id} className={`${cell} ${sel(q)}`}>
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
                label="Detalhamento"
                quotes={quotes}
                cell={cell}
                rowLabel={rowLabel}
                sel={sel}
                render={(q) =>
                  q.lines.length === 0 ? (
                    "—"
                  ) : (
                    <details>
                      <summary className="cursor-pointer text-secondary text-xs font-bold">
                        Ver {q.lines.length} {q.lines.length === 1 ? "linha" : "linhas"}
                      </summary>
                      <div className="mt-2 space-y-2">
                        {QUOTE_SECTIONS.map((section) => {
                          const sectionLines = q.lines.filter((l) => l.section === section.value);
                          if (sectionLines.length === 0) return null;
                          return (
                            <div key={section.value}>
                              <p className="text-[11px] font-bold uppercase tracking-wide text-outline">{section.label}</p>
                              <ul className="space-y-1">
                                {sectionLines.map((l) => (
                                  <li key={l.id} className="text-xs">
                                    <span className="flex justify-between gap-2">
                                      <span>{l.description}</span>
                                      <span className="font-mono-data whitespace-nowrap">
                                        {formatMoney(Number(l.total), l.currency)}
                                      </span>
                                    </span>
                                    {(l.quantity || l.unitPrice) && (
                                      <span className="block text-[11px] text-on-surface-variant">
                                        {l.quantity ? `${Number(l.quantity).toLocaleString("pt-BR")} × ` : ""}
                                        {l.unitPrice ? formatMoney(Number(l.unitPrice), l.currency) : ""}
                                        {l.unit ? ` ${quoteUnitLabel(l.unit)}` : ""}
                                        {l.minimum && Number(l.minimum) > 0
                                          ? ` · mín. ${formatMoney(Number(l.minimum), l.currency)}`
                                          : ""}
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )
                }
              />
              <Row
                label="Coleta"
                quotes={quotes}
                cell={cell}
                rowLabel={rowLabel}
                sel={sel}
                render={(q) => q.pickupAddress ?? "—"}
              />
              <Row
                label="Observações"
                quotes={quotes}
                cell={cell}
                rowLabel={rowLabel}
                sel={sel}
                render={(q) => (q.notes ? <span className="whitespace-pre-wrap">{q.notes}</span> : "—")}
              />
              <Row
                label="Proposta (arquivo)"
                quotes={quotes}
                cell={cell}
                rowLabel={rowLabel}
                sel={sel}
                render={(q) =>
                  q.fileName ? (
                    <DocumentViewer
                      src={`/api/processos/cotacoes/${q.id}`}
                      fileName={q.fileName}
                      className="text-secondary font-semibold break-all"
                    />
                  ) : (
                    "—"
                  )
                }
              />
              {!closed && (
                <tr>
                  <th className={rowLabel} />
                  {quotes.map((q) => (
                    <td key={q.id} className={`${cell} ${sel(q)}`}>
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
  sel,
  render,
}: {
  label: string;
  quotes: FreightQuoteRow[];
  cell: string;
  rowLabel: string;
  sel: (q: FreightQuoteRow) => string;
  render: (q: FreightQuoteRow) => ReactNode;
}) {
  return (
    <tr>
      <th className={rowLabel}>{label}</th>
      {quotes.map((q) => (
        <td key={q.id} className={`${cell} ${sel(q)}`}>
          {render(q)}
        </td>
      ))}
    </tr>
  );
}
