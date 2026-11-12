"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { saveSupplierQuote, deleteSupplierQuote } from "@/app/processos/supplier-quotes-actions";
import DocumentViewer from "@/components/DocumentViewer";
import QuoteHistory from "@/components/QuoteHistory";
import SubmitButton from "@/components/SubmitButton";
import { INCOTERMS } from "@/lib/incoterms";
import { driveDownloadUrl } from "@/lib/drive-links";
import { formatMoney } from "@/lib/freight-quotes";
import type { QuoteEventRow } from "@/lib/quote-events";
import { MAX_SUPPLIER_QUOTE_ITEMS, SUPPLIER_QUOTE_STATUSES, supplierItemTotal } from "@/lib/supplier-quotes";

// Cotação com o FORNECEDOR: um cartão por cotação (pode haver várias por
// fornecedor), cada um com situação, valores, condições, documentos e
// histórico próprios. Independe da cotação do agente de cargas: cadastrar ou
// aprovar uma nunca exige a outra.

export type SupplierQuoteItemRow = {
  id: string;
  sku: string | null;
  description: string;
  quantity: string | null;
  unitPrice: string | null;
  total: string;
};

export type SupplierQuoteRow = {
  id: string;
  supplierId: string | null;
  supplierName: string | null;
  proposal: string | null;
  quoteDate: string | null;
  validUntil: string | null;
  status: string;
  currency: string;
  totalValue: string | null;
  incoterm: string | null;
  commercialTerms: string | null;
  paymentTerms: string | null;
  productionDays: number | null;
  driveUrl: string | null;
  fileName: string | null;
  notes: string | null;
  items: SupplierQuoteItemRow[];
};

type Defaults = { supplierId: string | null; currency: string | null; incoterm: string | null };

type ItemDraft = { sku: string; description: string; quantity: string; unitPrice: string; total: string };

type Draft = {
  supplierId: string;
  proposal: string;
  quoteDate: string;
  validUntil: string;
  status: string;
  currency: string;
  totalValue: string;
  incoterm: string;
  commercialTerms: string;
  paymentTerms: string;
  productionDays: string;
  driveUrl: string;
  notes: string;
  items: ItemDraft[];
  removeFile: boolean;
  newFileName: string;
};

type Card = {
  key: string;
  quoteId: string | null;
  savedFileName: string | null;
  draft: Draft;
  base: string; // JSON do rascunho no último estado salvo — para saber se há alteração
  fileNonce: number;
  colorIdx: number;
};

const CURRENCIES = ["USD", "BRL", "EUR", "CNY", "GBP", "JPY", "OTHER"];
const COLORS = ["#1f9d8f", "#2b7bbf", "#7b5ea7", "#d99a14", "#d9534f", "#c026d3"];
const CLOSED_STATUSES = ["APROVADA", "RECUSADA", "EXPIRADA"];

const num = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "" : String(Number(v));

const toNumber = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const money = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function emptyDraft(d: Defaults): Draft {
  return {
    supplierId: d.supplierId ?? "",
    proposal: "",
    quoteDate: "",
    validUntil: "",
    status: "SOLICITADA",
    currency: d.currency && CURRENCIES.includes(d.currency) ? d.currency : "USD",
    totalValue: "",
    incoterm: d.incoterm ?? "",
    commercialTerms: "",
    paymentTerms: "",
    productionDays: "",
    driveUrl: "",
    notes: "",
    items: [],
    removeFile: false,
    newFileName: "",
  };
}

function draftFromQuote(q: SupplierQuoteRow, d: Defaults): Draft {
  return {
    ...emptyDraft(d),
    supplierId: q.supplierId ?? "",
    proposal: q.proposal ?? "",
    quoteDate: q.quoteDate ?? "",
    validUntil: q.validUntil ?? "",
    status: q.status,
    currency: q.currency,
    totalValue: num(q.totalValue),
    incoterm: q.incoterm ?? "",
    commercialTerms: q.commercialTerms ?? "",
    paymentTerms: q.paymentTerms ?? "",
    productionDays: num(q.productionDays),
    driveUrl: q.driveUrl ?? "",
    notes: q.notes ?? "",
    items: q.items.map((it) => ({
      sku: it.sku ?? "",
      description: it.description,
      quantity: num(it.quantity),
      unitPrice: num(it.unitPrice),
      total: num(it.total),
    })),
  };
}

// Total de um item: o digitado ou quantidade × preço unitário.
const itemTotalOf = (it: ItemDraft) =>
  toNumber(it.total) ?? supplierItemTotal(toNumber(it.quantity), toNumber(it.unitPrice));

const itemsSum = (items: ItemDraft[]) =>
  Math.round(items.reduce((s, it) => s + (itemTotalOf(it) ?? 0), 0) * 100) / 100;

let seq = 0;

const input =
  "w-full bg-surface-container-low border border-outline-variant/60 rounded px-2 py-1 text-xs focus:outline-none focus:border-secondary transition-all disabled:opacity-70";
const moneyInput = `${input} font-mono-data text-right`;

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}

export default function ProcessSupplierQuotes({
  processId,
  quotes,
  suppliers,
  defaults,
  events,
  closed,
}: {
  processId: string;
  quotes: SupplierQuoteRow[];
  suppliers: { id: string; name: string }[];
  defaults: Defaults;
  events: QuoteEventRow[];
  closed: boolean;
}) {
  const [cards, setCards] = useState<Card[]>(() =>
    quotes.map((q, i) => {
      const draft = draftFromQuote(q, defaults);
      return {
        key: q.id,
        quoteId: q.id,
        savedFileName: q.fileName,
        draft,
        base: JSON.stringify(draft),
        fileNonce: 0,
        colorIdx: i,
      };
    }),
  );
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Sincroniza com os dados do servidor (depois de salvar/remover), sem apagar
  // o que o usuário está digitando em outros cartões.
  const sig = JSON.stringify(quotes);
  const [prevSig, setPrevSig] = useState(sig);
  if (sig !== prevSig) {
    setPrevSig(sig);
    setCards((prev) => {
      const next: Card[] = [];
      for (const q of quotes) {
        const fresh = draftFromQuote(q, defaults);
        const freshJson = JSON.stringify(fresh);
        const existing = prev.find((c) => c.quoteId === q.id);
        if (existing) {
          const dirty = JSON.stringify(existing.draft) !== existing.base;
          const keepDraft = dirty && JSON.stringify(existing.draft) !== freshJson;
          next.push({
            ...existing,
            savedFileName: q.fileName,
            draft: keepDraft ? existing.draft : fresh,
            base: freshJson,
          });
        } else {
          next.push({
            key: q.id,
            quoteId: q.id,
            savedFileName: q.fileName,
            draft: fresh,
            base: freshJson,
            fileNonce: 0,
            colorIdx: next.length,
          });
        }
      }
      // cartões novos ainda não salvos continuam no fim
      for (const c of prev) if (c.quoteId === null) next.push({ ...c });
      return next.map((c, i) => ({ ...c, colorIdx: i }));
    });
  }

  const patch = (key: string, p: Partial<Draft>) =>
    setCards((prev) => prev.map((c) => (c.key === key ? { ...c, draft: { ...c.draft, ...p } } : c)));

  const patchItem = (key: string, index: number, p: Partial<ItemDraft>) =>
    setCards((prev) =>
      prev.map((c) =>
        c.key === key
          ? { ...c, draft: { ...c.draft, items: c.draft.items.map((it, i) => (i === index ? { ...it, ...p } : it)) } }
          : c,
      ),
    );

  function addCard() {
    const key = `new-${++seq}`;
    const draft = emptyDraft(defaults);
    setCards((prev) => [
      ...prev,
      { key, quoteId: null, savedFileName: null, draft, base: JSON.stringify(draft), fileNonce: 0, colorIdx: prev.length },
    ]);
  }

  async function save(card: Card) {
    const form = document.getElementById(`sq-${card.key}`) as HTMLFormElement | null;
    if (!form) return;
    setSavingKey(card.key);
    try {
      const res = await saveSupplierQuote(processId, card.quoteId, new FormData(form));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.created ? "Cotação do fornecedor adicionada." : "Cotação do fornecedor atualizada.");
      setCards((prev) =>
        prev
          .map((c) =>
            c.key === card.key
              ? {
                  ...c,
                  quoteId: res.id,
                  savedFileName: res.fileName,
                  draft: { ...c.draft, removeFile: false, newFileName: "" },
                  base: JSON.stringify({ ...c.draft, removeFile: false, newFileName: "" }),
                  fileNonce: c.fileNonce + 1,
                }
              : c,
          )
          // os dados do servidor podem ter chegado antes deste retorno e criado
          // um cartão igual para a cotação nova: fica só o do usuário
          .filter((c) => !(c.quoteId === res.id && c.key !== card.key)),
      );
    } catch {
      toast.error("Não foi possível salvar a cotação. Tente novamente.");
    } finally {
      setSavingKey(null);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="min-w-0 max-w-full bg-surface-container-lowest border border-outline-variant p-gutter rounded-xl shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-stack-md">
        <div className="min-w-0">
          <h3 className="font-headline-sm text-headline-sm text-primary">Cotações com o Fornecedor</h3>
          <p className="text-xs text-on-surface-variant">
            Valores dos produtos, condições comerciais, pagamento e prazo de produção. Cada cotação tem situação,
            documentos e histórico próprios e não depende da cotação de frete.
          </p>
        </div>
        {!closed && (
          <button
            type="button"
            onClick={addCard}
            className="px-4 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all"
          >
            + Adicionar cotação
          </button>
        )}
      </div>

      {cards.length === 0 ? (
        <p className="text-on-surface-variant font-body-sm text-body-sm">
          Nenhuma cotação com fornecedor registrada ainda.
          {suppliers.length === 0 && " Cadastre um fornecedor em Fornecedores antes de adicionar."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 2xl:grid-cols-3">
          {cards.map((c) => {
            const d = c.draft;
            const dirty = JSON.stringify(d) !== c.base;
            const saving = savingKey === c.key;
            const approved = d.status === "APROVADA";
            const st = SUPPLIER_QUOTE_STATUSES.find((s) => s.value === d.status) ?? SUPPLIER_QUOTE_STATUSES[0];
            const sum = itemsSum(d.items);
            const typedTotal = toNumber(d.totalValue);
            const href = driveDownloadUrl(d.driveUrl.trim());
            const expired = d.validUntil && d.validUntil < today && !CLOSED_STATUSES.includes(d.status);
            const cardEvents = c.quoteId ? events.filter((e) => e.quoteId === c.quoteId) : [];
            return (
              <article
                key={c.key}
                className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest"
                style={{ boxShadow: approved ? "0 0 0 3px #22c55e" : undefined }}
              >
                {/* Cabeçalho colorido: fornecedor + selos */}
                <div
                  className="flex items-center gap-1.5 px-2 py-2"
                  style={{ background: COLORS[c.colorIdx % COLORS.length] }}
                >
                  <select
                    form={`sq-${c.key}`}
                    name="supplierId"
                    value={d.supplierId}
                    disabled={closed}
                    onChange={(e) => patch(c.key, { supplierId: e.target.value })}
                    aria-label="Fornecedor"
                    className="min-w-0 flex-1 cursor-pointer bg-transparent text-xs font-bold uppercase text-white focus:outline-none"
                  >
                    <option value="" className="text-black">
                      Selecione o fornecedor
                    </option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id} className="text-black">
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {approved && (
                    <span className="shrink-0 rounded-full bg-green-500 px-2 py-0.5 text-[11px] font-bold text-black">
                      APROVADA
                    </span>
                  )}
                </div>

                <form
                  id={`sq-${c.key}`}
                  onSubmit={(e) => e.preventDefault()}
                  className="flex flex-1 flex-col gap-2.5 p-3"
                >
                  <Field label="Situação">
                    <select
                      name="status"
                      value={d.status}
                      disabled={closed}
                      onChange={(e) => patch(c.key, { status: e.target.value })}
                      aria-label="Situação da cotação"
                      className="w-full appearance-none rounded px-2 py-1 text-center text-xs font-bold uppercase text-white focus:outline-none"
                      style={{ background: st.color }}
                    >
                      {SUPPLIER_QUOTE_STATUSES.map((s) => (
                        <option key={s.value} value={s.value} className="text-black">
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Nº da proposta">
                      <input name="proposal" value={d.proposal} disabled={closed}
                        onChange={(e) => patch(c.key, { proposal: e.target.value })}
                        placeholder="Ex: PI-2026-014" className={input} />
                    </Field>
                    <Field label="Data da cotação">
                      <input name="quoteDate" type="date" value={d.quoteDate} disabled={closed}
                        onChange={(e) => patch(c.key, { quoteDate: e.target.value })} className={input} />
                    </Field>
                    <Field label="Validade">
                      <input name="validUntil" type="date" value={d.validUntil} disabled={closed}
                        onChange={(e) => patch(c.key, { validUntil: e.target.value })} className={input} />
                      {expired && <p className="mt-0.5 text-[11px] font-bold text-error">Cotação vencida</p>}
                    </Field>
                    <Field label="Prazo de produção (dias)">
                      <input name="productionDays" type="number" min="0" step="1" value={d.productionDays}
                        disabled={closed} onChange={(e) => patch(c.key, { productionDays: e.target.value })}
                        placeholder="Ex: 45" className={moneyInput} />
                    </Field>
                  </div>

                  <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
                    <Field label="Moeda">
                      <select name="currency" value={d.currency} disabled={closed}
                        onChange={(e) => patch(c.key, { currency: e.target.value })}
                        className={`${input} appearance-none text-center`}>
                        {CURRENCIES.map((m) => (
                          <option key={m} value={m}>
                            {m === "OTHER" ? "Outra" : m}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Valor total dos produtos">
                      <input name="totalValue" type="number" step="any" min="0" inputMode="decimal"
                        value={d.totalValue} disabled={closed}
                        onChange={(e) => patch(c.key, { totalValue: e.target.value })}
                        placeholder={d.items.length > 0 ? money(sum) : "0,00"} className={moneyInput} />
                    </Field>
                  </div>
                  {typedTotal !== null && typedTotal > 0 && (
                    <p className="-mt-1.5 text-right font-mono-data text-xs font-extrabold text-primary">
                      {formatMoney(typedTotal, d.currency)}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Incoterm">
                      <select name="incoterm" value={d.incoterm} disabled={closed}
                        onChange={(e) => patch(c.key, { incoterm: e.target.value })}
                        className={`${input} appearance-none`}>
                        <option value="">EXW, FOB, CIF…</option>
                        {INCOTERMS.map((t) => (
                          <option key={t} value={t}>
                            {t.split(" - ")[0]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Forma / condição de pagamento">
                      <input name="paymentTerms" value={d.paymentTerms} disabled={closed}
                        onChange={(e) => patch(c.key, { paymentTerms: e.target.value })}
                        placeholder="Ex: 30% sinal + 70% embarque" className={input} />
                    </Field>
                  </div>

                  <Field label="Condições comerciais">
                    <textarea name="commercialTerms" rows={2} value={d.commercialTerms} disabled={closed}
                      onChange={(e) => patch(c.key, { commercialTerms: e.target.value })}
                      placeholder="Ex: preço FOB Shenzhen, embalagem inclusa, garantia 12 meses"
                      className={input} />
                  </Field>

                  {/* Valores por item (opcional) */}
                  <details className="rounded-lg border border-outline-variant/60 bg-surface-container-low" open={d.items.length > 0 && c.quoteId === null}>
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant hover:text-secondary [&::-webkit-details-marker]:hidden">
                      Valores por item ({d.items.length})
                      {d.items.length > 0 && (
                        <span className="ml-auto font-mono-data normal-case text-primary">
                          soma {formatMoney(sum, d.currency)}
                        </span>
                      )}
                    </summary>
                    <div className="space-y-2 px-2 pb-2">
                      {d.items.map((it, i) => (
                        <div key={i} className="space-y-1 rounded border border-outline-variant/50 bg-surface-container-lowest p-1.5">
                          <div className="grid grid-cols-[minmax(0,90px)_minmax(0,1fr)] gap-1">
                            <input name="itemSku" value={it.sku} disabled={closed}
                              onChange={(e) => patchItem(c.key, i, { sku: e.target.value })}
                              aria-label={`Item ${i + 1} — SKU`} placeholder="SKU" className={input} />
                            <input name="itemDescription" value={it.description} disabled={closed}
                              onChange={(e) => patchItem(c.key, i, { description: e.target.value })}
                              aria-label={`Item ${i + 1} — descrição`} placeholder="Descrição" className={input} />
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            <input name="itemQuantity" type="number" step="any" min="0" value={it.quantity} disabled={closed}
                              onChange={(e) => patchItem(c.key, i, { quantity: e.target.value })}
                              aria-label={`Item ${i + 1} — quantidade`} placeholder="Qtd" className={moneyInput} />
                            <input name="itemUnitPrice" type="number" step="any" min="0" value={it.unitPrice} disabled={closed}
                              onChange={(e) => patchItem(c.key, i, { unitPrice: e.target.value })}
                              aria-label={`Item ${i + 1} — preço unitário`} placeholder="Unitário" className={moneyInput} />
                            <input name="itemTotal" type="number" step="any" min="0" value={it.total} disabled={closed}
                              onChange={(e) => patchItem(c.key, i, { total: e.target.value })}
                              aria-label={`Item ${i + 1} — total`}
                              placeholder={itemTotalOf({ ...it, total: "" })?.toFixed(2) ?? "Total"} className={moneyInput} />
                          </div>
                          {!closed && (
                            <button
                              type="button"
                              onClick={() =>
                                setCards((prev) =>
                                  prev.map((x) =>
                                    x.key === c.key ? { ...x, draft: { ...x.draft, items: x.draft.items.filter((_, j) => j !== i) } } : x,
                                  ),
                                )
                              }
                              className="text-[11px] font-bold text-error hover:underline"
                            >
                              Remover item
                            </button>
                          )}
                        </div>
                      ))}
                      {!closed && (
                        <div className="flex flex-wrap items-center gap-2">
                          {d.items.length < MAX_SUPPLIER_QUOTE_ITEMS && (
                            <button
                              type="button"
                              onClick={() =>
                                patch(c.key, { items: [...d.items, { sku: "", description: "", quantity: "", unitPrice: "", total: "" }] })
                              }
                              className="text-[11px] font-bold text-secondary hover:underline"
                            >
                              + item
                            </button>
                          )}
                          {d.items.length > 0 && (
                            <button
                              type="button"
                              onClick={() => patch(c.key, { totalValue: String(sum) })}
                              className="text-[11px] font-bold text-secondary hover:underline"
                              title="Usa a soma dos itens como valor total da cotação"
                            >
                              Usar a soma como total
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </details>

                  {/* Documentos */}
                  <Field label="Link do Google Drive">
                    <div className="flex items-center gap-1">
                      <input name="driveUrl" type="url" value={d.driveUrl} disabled={closed}
                        onChange={(e) => patch(c.key, { driveUrl: e.target.value })}
                        aria-label="Link do Google Drive da cotação" placeholder="Cole o link do Google Drive"
                        className={input} />
                      {href && (
                        <a href={href} target="_blank" rel="noopener noreferrer" title="Baixar a cotação do Google Drive"
                          className="shrink-0 rounded bg-secondary px-2 py-1 text-[11px] font-bold text-white hover:opacity-90">
                          Baixar
                        </a>
                      )}
                    </div>
                  </Field>
                  <div className="space-y-1">
                    <span className="block text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Arquivo</span>
                    {c.savedFileName && c.quoteId && (
                      <div className="text-xs">
                        <DocumentViewer
                          src={`/api/processos/cotacoes-fornecedor/${c.quoteId}`}
                          fileName={c.savedFileName}
                          className="break-all font-semibold text-secondary"
                        />
                        <label className="mt-0.5 flex items-center gap-1 text-[11px] text-on-surface-variant">
                          <input type="checkbox" name="removeFile" value="1" checked={d.removeFile}
                            onChange={(e) => patch(c.key, { removeFile: e.target.checked })} />
                          remover
                        </label>
                      </div>
                    )}
                    {!closed && (
                      <input
                        key={c.fileNonce}
                        type="file"
                        name="file"
                        accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.doc,.docx"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f && f.size > 4 * 1024 * 1024) {
                            toast.error("O arquivo passa de 4 MB. Reduza ou comprima e escolha de novo.");
                            e.target.value = "";
                            patch(c.key, { newFileName: "" });
                            return;
                          }
                          patch(c.key, { newFileName: f?.name ?? "" });
                        }}
                        className="block w-full text-[11px] file:mr-2 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-[11px] file:font-bold file:text-white"
                      />
                    )}
                  </div>

                  <Field label="Observações">
                    <textarea name="notes" rows={2} value={d.notes} disabled={closed}
                      onChange={(e) => patch(c.key, { notes: e.target.value })}
                      placeholder="Ex: preço sujeito a reajuste da matéria-prima" className={input} />
                  </Field>
                </form>

                {/* Ações e histórico */}
                <div className="space-y-2 border-t border-outline-variant/40 p-3">
                  {!closed && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => save(c)}
                        disabled={saving || (!dirty && c.quoteId !== null)}
                        className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-40"
                      >
                        {saving ? "Salvando…" : dirty || c.quoteId === null ? "Salvar" : "Salvo"}
                      </button>
                      {c.quoteId === null ? (
                        <button
                          type="button"
                          onClick={() => setCards((prev) => prev.filter((x) => x.key !== c.key))}
                          className="rounded-lg px-2 py-1.5 text-xs font-bold text-on-surface-variant hover:bg-surface-container-high"
                        >
                          Descartar
                        </button>
                      ) : (
                        <form
                          action={deleteSupplierQuote.bind(null, c.quoteId, processId)}
                          onSubmit={(e) => {
                            if (!window.confirm("Remover esta cotação do fornecedor?")) e.preventDefault();
                          }}
                        >
                          <SubmitButton className="rounded-lg px-2 py-1.5 text-xs font-bold text-error hover:bg-error-container/30">
                            Remover
                          </SubmitButton>
                        </form>
                      )}
                      {dirty && c.quoteId !== null && <span className="text-[11px] text-warning">Alterações não salvas</span>}
                    </div>
                  )}
                  {c.quoteId ? (
                    <QuoteHistory events={cardEvents} />
                  ) : (
                    <p className="text-[11px] text-on-surface-variant">O histórico começa quando a cotação for salva.</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
