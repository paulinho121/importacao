"use client";

import { Fragment, useState, type ReactNode } from "react";
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
import {
  computeLineTotal,
  formatMoney,
  totalBRL,
  totalsByCurrency,
  type QuoteLineAmount,
  type QuoteSection,
} from "@/lib/freight-quotes";

// Cotações de frete no formato da planilha de comparação do time: uma coluna
// por agente de carga, lado a lado, com "moeda | custos" em cada linha. Tudo
// é editável na própria tela e cada coluna é salva separadamente, para
// comparar várias cotações do mesmo processo.

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

type Defaults = { modal: string | null; incoterm: string | null; weightKg: string | null };

// ------------------------------------------------------------ rascunho (coluna)

type Draft = {
  agentId: string;
  proposal: string;
  incoterm: string;
  modal: string;
  transitDays: string;
  transitDaysMax: string;
  origin: string;
  destination: string;
  carrier: string;
  validUntil: string;
  grossWeightKg: string;
  freightRate: string;
  freightCurrency: string;
  originFee: string;
  originCurrency: string;
  destinationFee: string;
  destinationCurrency: string;
  dta: string;
  dtaCurrency: string;
  otherFee: string;
  otherCurrency: string;
  notes: string;
  // "Mais dados da proposta"
  route: string;
  quoteDate: string;
  frequency: string;
  cargoDescription: string;
  volumes: string;
  volumeM3: string;
  dimensions: string;
  cargoValue: string;
  cargoValueCurrency: string;
  pickupAddress: string;
  removeFile: boolean;
  newFileName: string;
};

type Col = {
  key: string;
  quoteId: string | null;
  savedFileName: string | null;
  isSelected: boolean;
  draft: Draft;
  base: string; // JSON do rascunho no último estado salvo — para saber se há alteração
  fileNonce: number;
  colorIdx: number;
};

const num = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "" : String(Number(v));

const EMPTY_DATE = "";

function emptyDraft(d: Defaults): Draft {
  return {
    agentId: "",
    proposal: "",
    incoterm: d.incoterm ?? "",
    modal: d.modal ?? "",
    transitDays: "",
    transitDaysMax: "",
    origin: "",
    destination: "",
    carrier: "",
    validUntil: EMPTY_DATE,
    grossWeightKg: num(d.weightKg),
    freightRate: "",
    freightCurrency: "USD",
    originFee: "",
    originCurrency: "USD",
    destinationFee: "",
    destinationCurrency: "USD",
    dta: "",
    dtaCurrency: "BRL",
    otherFee: "",
    otherCurrency: "BRL",
    notes: "",
    route: "",
    quoteDate: EMPTY_DATE,
    frequency: "",
    cargoDescription: "",
    volumes: "",
    volumeM3: "",
    dimensions: "",
    cargoValue: "",
    cargoValueCurrency: "USD",
    pickupAddress: "",
    removeFile: false,
    newFileName: "",
  };
}

function draftFromQuote(q: FreightQuoteRow, d: Defaults): Draft {
  const base = emptyDraft(d);
  const bySection = (s: QuoteSection) => q.lines.filter((l) => l.section === s);
  const freight = bySection("FRETE")[0];
  const origin = bySection("ORIGEM")[0];
  const destination = bySection("DESTINO")[0];
  const outras = bySection("OUTRAS");
  const dta = outras.find((l) => /^dta$/i.test(l.description.trim()));
  const other = outras.find((l) => l !== dta);
  return {
    ...base,
    agentId: q.agentId ?? "",
    proposal: q.proposal ?? "",
    incoterm: q.incoterm ?? "",
    modal: q.modal ?? "",
    transitDays: num(q.transitDays),
    transitDaysMax: num(q.transitDaysMax),
    origin: q.origin ?? "",
    destination: q.destination ?? "",
    carrier: q.carrier ?? "",
    validUntil: q.validUntil ?? "",
    grossWeightKg: num(q.grossWeightKg),
    freightRate: freight ? num(freight.unitPrice ?? freight.total) : "",
    freightCurrency: freight?.currency ?? "USD",
    originFee: origin ? num(origin.total) : "",
    originCurrency: origin?.currency ?? "USD",
    destinationFee: destination ? num(destination.total) : "",
    destinationCurrency: destination?.currency ?? "USD",
    dta: dta ? num(dta.total) : "",
    dtaCurrency: dta?.currency ?? "BRL",
    otherFee: other ? num(other.total) : "",
    otherCurrency: other?.currency ?? "BRL",
    notes: q.notes ?? "",
    route: q.route ?? "",
    quoteDate: q.quoteDate ?? "",
    frequency: q.frequency ?? "",
    cargoDescription: q.cargoDescription ?? "",
    volumes: num(q.volumes),
    volumeM3: num(q.volumeM3),
    dimensions: q.dimensions ?? "",
    cargoValue: num(q.cargoValue),
    cargoValueCurrency: q.cargoValueCurrency ?? "USD",
    pickupAddress: q.pickupAddress ?? "",
  };
}

function toNumber(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Frete = carga (kg) × tarifa por kg; sem kg informado, a tarifa é tratada
// como valor total (frete fechado).
function freightTotal(d: Draft): number | null {
  const rate = toNumber(d.freightRate);
  if (rate === null) return null;
  const kg = toNumber(d.grossWeightKg);
  return kg !== null && kg > 0 ? computeLineTotal(kg, rate, null) : rate;
}

type SubmitLine = {
  section: QuoteSection;
  description: string;
  quantity: string;
  unitPrice: string;
  unit: string;
  currency: string;
  total: number;
};

// Linhas que a coluna grava no banco (só as preenchidas).
function linesOf(d: Draft): SubmitLine[] {
  const out: SubmitLine[] = [];
  const freight = freightTotal(d);
  if (freight !== null) {
    const kg = toNumber(d.grossWeightKg);
    const hasKg = kg !== null && kg > 0;
    out.push({
      section: "FRETE",
      description: "Frete",
      quantity: hasKg ? String(kg) : "",
      unitPrice: hasKg ? d.freightRate : "",
      unit: hasKg ? "KG" : "",
      currency: d.freightCurrency,
      total: freight,
    });
  }
  const simple: [QuoteSection, string, string, string][] = [
    ["ORIGEM", "Taxas de origem", d.originFee, d.originCurrency],
    ["DESTINO", "Taxas de destino", d.destinationFee, d.destinationCurrency],
    ["OUTRAS", "DTA", d.dta, d.dtaCurrency],
    ["OUTRAS", "Outras taxas / custo adicional", d.otherFee, d.otherCurrency],
  ];
  for (const [section, description, value, currency] of simple) {
    const n = toNumber(value);
    if (n !== null) out.push({ section, description, quantity: "", unitPrice: "", unit: "", currency, total: n });
  }
  return out;
}

const COLORS = ["#1f9d8f", "#2b7bbf", "#7b5ea7", "#d99a14", "#d9534f", "#c026d3"];

let seq = 0;

// ----------------------------------------------------------------- estilos

const cellInput =
  "w-full bg-surface-container-low border border-outline-variant/60 rounded px-2 py-1 text-xs focus:outline-none focus:border-secondary transition-all";
const moneyInput = `${cellInput} font-mono-data text-right`;
const labelCell =
  "sticky left-0 z-10 bg-surface-container-lowest py-1.5 pr-3 pl-2 text-left align-middle font-label-md text-label-md text-on-surface-variant whitespace-nowrap border-t border-outline-variant/40";
const dataCell = "py-1.5 px-1.5 align-middle border-t border-l border-outline-variant/40";
const CURRENCIES = ["USD", "BRL", "EUR", "CNY", "GBP", "JPY", "OTHER"];

// ---------------------------------------------------------------- componente

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
  defaults: Defaults;
  closed: boolean;
}) {
  const [cols, setCols] = useState<Col[]>(() =>
    quotes.map((q, i) => {
      const draft = draftFromQuote(q, defaults);
      return {
        key: q.id,
        quoteId: q.id,
        savedFileName: q.fileName,
        isSelected: q.isSelected,
        draft,
        base: JSON.stringify(draft),
        fileNonce: 0,
        colorIdx: i,
      };
    }),
  );
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  // Sincroniza com os dados do servidor (depois de salvar/escolher/remover),
  // sem apagar o que o usuário está digitando em outras colunas.
  const sig = JSON.stringify(quotes);
  const [prevSig, setPrevSig] = useState(sig);
  if (sig !== prevSig) {
    setPrevSig(sig);
    setCols((prev) => {
      const next: Col[] = [];
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
            isSelected: q.isSelected,
            draft: keepDraft ? existing.draft : fresh,
            base: freshJson,
          });
        } else {
          next.push({
            key: q.id,
            quoteId: q.id,
            savedFileName: q.fileName,
            isSelected: q.isSelected,
            draft: fresh,
            base: freshJson,
            fileNonce: 0,
            colorIdx: next.length,
          });
        }
      }
      // colunas novas ainda não salvas continuam no fim
      for (const c of prev) if (c.quoteId === null) next.push({ ...c, colorIdx: next.length });
      return next.map((c, i) => ({ ...c, colorIdx: i }));
    });
  }

  function patch(key: string, p: Partial<Draft>) {
    setCols((prev) => prev.map((c) => (c.key === key ? { ...c, draft: { ...c.draft, ...p } } : c)));
  }

  function addColumn() {
    const key = `new-${++seq}`;
    setCols((prev) => [
      ...prev,
      {
        key,
        quoteId: null,
        savedFileName: null,
        isSelected: false,
        draft: emptyDraft(defaults),
        base: JSON.stringify(emptyDraft(defaults)),
        fileNonce: 0,
        colorIdx: prev.length,
      },
    ]);
  }

  async function save(col: Col) {
    const form = document.getElementById(`fq-${col.key}`) as HTMLFormElement | null;
    if (!form) return;
    setSavingKey(col.key);
    try {
      const res = await saveFreightQuote(processId, col.quoteId, new FormData(form));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.created ? "Cotação adicionada." : "Cotação atualizada.");
      setCols((prev) =>
        prev
          .map((c) =>
            c.key === col.key
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
          // os dados do servidor podem ter chegado antes deste retorno e
          // criado uma coluna igual para a cotação nova: fica só a do usuário
          .filter((c) => !(c.quoteId === res.id && c.key !== col.key)),
      );
    } catch {
      toast.error("Não foi possível salvar a cotação. Tente novamente.");
    } finally {
      setSavingKey(null);
    }
  }

  const computed = cols.map((c) => {
    const lines: QuoteLineAmount[] = linesOf(c.draft).map((l) => ({
      section: l.section,
      currency: l.currency,
      total: l.total,
    }));
    return {
      lines,
      totals: totalsByCurrency(lines),
      brl: lines.length > 0 ? totalBRL(lines, processCurrency, exchangeRate) : null,
    };
  });
  const comparable = computed.map((c) => c.brl).filter((v): v is number => v !== null);
  const cheapest = comparable.length >= 2 ? Math.min(...comparable) : null;

  const nCols = cols.length;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="bg-surface-container-lowest border border-outline-variant p-gutter rounded-xl shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-stack-md">
        <div>
          <h3 className="font-headline-sm text-headline-sm text-primary">Cotações de Frete</h3>
          <p className="text-xs text-on-surface-variant">
            Uma coluna por agente de carga, como na planilha. Preencha a moeda e o valor de cada linha e clique em
            Salvar na coluna. Ao escolher uma cotação, o agente e o frete (+ taxa de origem) vão para o processo.
          </p>
        </div>
        {!closed && (
          <button
            type="button"
            onClick={addColumn}
            className="px-4 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all"
          >
            + Adicionar cotação
          </button>
        )}
      </div>

      {nCols === 0 ? (
        <p className="text-on-surface-variant font-body-sm text-body-sm">
          Nenhuma cotação registrada ainda.{" "}
          {agents.length === 0 && "Cadastre um agente de carga em Agentes antes de adicionar."}
        </p>
      ) : (
        <>
          {/* Um <form> por coluna; os campos da tabela se ligam a ele pelo atributo `form`. */}
          <div hidden>
            {cols.map((c) => (
              <ColumnForm key={c.key} col={c} showMore={showMore} />
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="border-collapse text-body-sm font-body-sm min-w-full">
              <colgroup>
                <col style={{ width: 150 }} />
                {cols.map((c) => (
                  <Fragment key={c.key}>
                    <col style={{ width: 78 }} />
                    <col style={{ width: 132 }} />
                  </Fragment>
                ))}
              </colgroup>
              <tbody>
                {/* AGENTE DE CARGAS */}
                <tr>
                  <th className={labelCell}>Agente de cargas</th>
                  {cols.map((c) => (
                    <td
                      key={c.key}
                      colSpan={2}
                      className="p-0 border-l border-outline-variant/40"
                      style={{ background: COLORS[c.colorIdx % COLORS.length] }}
                    >
                      <div className="flex items-center gap-1 px-1.5 py-1.5">
                        <select
                          form={`fq-${c.key}`}
                          name="agentId"
                          value={c.draft.agentId}
                          disabled={closed}
                          onChange={(e) => patch(c.key, { agentId: e.target.value })}
                          aria-label="Agente de carga"
                          className="w-full bg-transparent text-white font-bold text-xs uppercase focus:outline-none cursor-pointer"
                        >
                          <option value="" className="text-black">
                            Selecione o agente
                          </option>
                          {agents.map((a) => (
                            <option key={a.id} value={a.id} className="text-black">
                              {a.name}
                            </option>
                          ))}
                        </select>
                        {c.isSelected && (
                          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-black">
                            ESCOLHIDA
                          </span>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>

                <TextRow label="Proposta" cols={cols} closed={closed} render={(c) => (
                  <input
                    form={`fq-${c.key}`}
                    name="proposal"
                    value={c.draft.proposal}
                    onChange={(e) => patch(c.key, { proposal: e.target.value })}
                    disabled={closed}
                    placeholder="Ex: RKT-014949-26"
                    className={cellInput}
                  />
                )} />
                <TextRow label="Incoterm" cols={cols} closed={closed} render={(c) => (
                  <select
                    form={`fq-${c.key}`}
                    name="incoterm"
                    value={c.draft.incoterm}
                    onChange={(e) => patch(c.key, { incoterm: e.target.value })}
                    disabled={closed}
                    className={`${cellInput} appearance-none`}
                  >
                    <option value="">—</option>
                    {INCOTERMS.map((t) => (
                      <option key={t} value={t}>
                        {t.split(" - ")[0]}
                      </option>
                    ))}
                  </select>
                )} />
                <TextRow label="Modal" cols={cols} closed={closed} render={(c) => (
                  <select
                    form={`fq-${c.key}`}
                    name="modal"
                    value={c.draft.modal}
                    onChange={(e) => patch(c.key, { modal: e.target.value })}
                    disabled={closed}
                    className={`${cellInput} appearance-none`}
                  >
                    {MODAIS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.value ? m.label : "—"}
                      </option>
                    ))}
                  </select>
                )} />

                {/* INFORMAÇÕES */}
                <TextRow label="Trânsito (dias)" cols={cols} closed={closed} render={(c) => (
                  <div className="flex items-center gap-1">
                    <input
                      form={`fq-${c.key}`}
                      name="transitDays"
                      type="number"
                      min="0"
                      step="1"
                      value={c.draft.transitDays}
                      onChange={(e) => patch(c.key, { transitDays: e.target.value })}
                      disabled={closed}
                      aria-label="Trânsito mínimo"
                      placeholder="de"
                      className={moneyInput}
                    />
                    <span className="text-[11px] text-on-surface-variant">a</span>
                    <input
                      form={`fq-${c.key}`}
                      name="transitDaysMax"
                      type="number"
                      min="0"
                      step="1"
                      value={c.draft.transitDaysMax}
                      onChange={(e) => patch(c.key, { transitDaysMax: e.target.value })}
                      disabled={closed}
                      aria-label="Trânsito máximo"
                      placeholder="até"
                      className={moneyInput}
                    />
                  </div>
                )} />
                <TextRow label="Origem" cols={cols} closed={closed} render={(c) => (
                  <input
                    form={`fq-${c.key}`}
                    name="origin"
                    value={c.draft.origin}
                    onChange={(e) => patch(c.key, { origin: e.target.value })}
                    disabled={closed}
                    placeholder="Ex: HKG"
                    className={cellInput}
                  />
                )} />
                <TextRow label="Destino" cols={cols} closed={closed} render={(c) => (
                  <input
                    form={`fq-${c.key}`}
                    name="destination"
                    value={c.draft.destination}
                    onChange={(e) => patch(c.key, { destination: e.target.value })}
                    disabled={closed}
                    placeholder="Ex: GRU"
                    className={cellInput}
                  />
                )} />
                <TextRow label="Cia" cols={cols} closed={closed} render={(c) => (
                  <input
                    form={`fq-${c.key}`}
                    name="carrier"
                    value={c.draft.carrier}
                    onChange={(e) => patch(c.key, { carrier: e.target.value })}
                    disabled={closed}
                    placeholder="Ex: Qatar Airways"
                    className={cellInput}
                  />
                )} />
                <TextRow label="Validade da proposta" cols={cols} closed={closed} render={(c) => (
                  <>
                    <input
                      form={`fq-${c.key}`}
                      name="validUntil"
                      type="date"
                      value={c.draft.validUntil}
                      onChange={(e) => patch(c.key, { validUntil: e.target.value })}
                      disabled={closed}
                      className={cellInput}
                    />
                    {c.draft.validUntil && c.draft.validUntil < today && (
                      <p className="mt-0.5 text-[10px] font-bold text-error">Proposta vencida</p>
                    )}
                  </>
                )} />

                {/* CARGA */}
                <TextRow label="Carga (kg)" cols={cols} closed={closed} section="CARGA" render={(c) => (
                  <input
                    form={`fq-${c.key}`}
                    name="grossWeightKg"
                    type="number"
                    step="any"
                    min="0"
                    value={c.draft.grossWeightKg}
                    onChange={(e) => patch(c.key, { grossWeightKg: e.target.value })}
                    disabled={closed}
                    className={moneyInput}
                  />
                )} />
                <MoneyRow label="Frete (por kg)" cols={cols} closed={closed} section="CARGA"
                  value={(d) => d.freightRate} currency={(d) => d.freightCurrency}
                  onValue={(c, v) => patch(c.key, { freightRate: v })}
                  onCurrency={(c, v) => patch(c.key, { freightCurrency: v })} />
                <tr>
                  <th className={labelCell}>Carga × Frete</th>
                  {cols.map((c) => {
                    const total = freightTotal(c.draft);
                    return (
                      <Fragment key={c.key}>
                        <td className={`${dataCell} text-center text-xs font-bold`}>
                          {total !== null ? c.draft.freightCurrency : ""}
                        </td>
                        <td className={`${dataCell} text-right font-mono-data font-bold text-xs`}>
                          {total !== null ? total.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—"}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>

                {/* TAXAS */}
                <MoneyRow label="Taxa de origem" cols={cols} closed={closed} section="TAXAS"
                  value={(d) => d.originFee} currency={(d) => d.originCurrency}
                  onValue={(c, v) => patch(c.key, { originFee: v })}
                  onCurrency={(c, v) => patch(c.key, { originCurrency: v })} />
                <MoneyRow label="Taxa de destino" cols={cols} closed={closed} section="TAXAS"
                  value={(d) => d.destinationFee} currency={(d) => d.destinationCurrency}
                  onValue={(c, v) => patch(c.key, { destinationFee: v })}
                  onCurrency={(c, v) => patch(c.key, { destinationCurrency: v })} />

                {/* OUTRAS */}
                <MoneyRow label="DTA" cols={cols} closed={closed} section="OUTRAS"
                  value={(d) => d.dta} currency={(d) => d.dtaCurrency}
                  onValue={(c, v) => patch(c.key, { dta: v })}
                  onCurrency={(c, v) => patch(c.key, { dtaCurrency: v })} />
                <MoneyRow label="Outras taxas / custo adicional" cols={cols} closed={closed} section="OUTRAS"
                  value={(d) => d.otherFee} currency={(d) => d.otherCurrency}
                  onValue={(c, v) => patch(c.key, { otherFee: v })}
                  onCurrency={(c, v) => patch(c.key, { otherCurrency: v })} />
                <TextRow label="Observação / ajuste" cols={cols} closed={closed} render={(c) => (
                  <textarea
                    form={`fq-${c.key}`}
                    name="notes"
                    rows={2}
                    value={c.draft.notes}
                    onChange={(e) => patch(c.key, { notes: e.target.value })}
                    disabled={closed}
                    placeholder="Ex: coleta inclusa"
                    className={cellInput}
                  />
                )} />

                {/* CUSTOS ESTIMADOS */}
                <tr className="bg-surface-container-high/60">
                  <th className={`${labelCell} text-primary font-bold`}>Custos estimados</th>
                  {cols.map((c, i) => {
                    const { totals, brl } = computed[i];
                    const mixed = totals.some((t) => t.currency !== "BRL");
                    return (
                      <td key={c.key} colSpan={2} className={`${dataCell} align-top`}>
                        {totals.length === 0 ? (
                          <span className="text-on-surface-variant">—</span>
                        ) : (
                          <>
                            {totals.map((t) => (
                              <p key={t.currency} className="flex justify-between gap-2 font-mono-data font-bold text-primary text-xs">
                                <span>{t.currency}</span>
                                <span>{t.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                              </p>
                            ))}
                            {mixed && brl !== null && (
                              <p className="flex justify-between gap-2 font-mono-data text-[11px] text-on-surface-variant mt-0.5">
                                <span>≈ BRL</span>
                                <span>{formatMoney(brl, "BRL").replace("R$ ", "")}</span>
                              </p>
                            )}
                            {mixed && brl === null && (
                              <p className="text-[10px] text-outline mt-0.5">
                                {exchangeRate ? "Moedas diferentes — sem conversão" : "Busque o câmbio p/ somar em R$"}
                              </p>
                            )}
                            {cheapest !== null && brl === cheapest && (
                              <span className="mt-1 inline-block rounded-full bg-tertiary-fixed px-2 py-0.5 text-[10px] font-bold text-on-tertiary-fixed-variant">
                                Menor custo
                              </span>
                            )}
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* MAIS DADOS DA PROPOSTA */}
                {showMore && (
                  <>
                    <TextRow label="Rota (escalas)" cols={cols} closed={closed} render={(c) => (
                      <input form={`fq-${c.key}`} name="route" value={c.draft.route} disabled={closed}
                        onChange={(e) => patch(c.key, { route: e.target.value })} placeholder="Ex: PKE-CDG-GRU" className={cellInput} />
                    )} />
                    <TextRow label="Data da cotação" cols={cols} closed={closed} render={(c) => (
                      <input form={`fq-${c.key}`} name="quoteDate" type="date" value={c.draft.quoteDate} disabled={closed}
                        onChange={(e) => patch(c.key, { quoteDate: e.target.value })} className={cellInput} />
                    )} />
                    <TextRow label="Frequência" cols={cols} closed={closed} render={(c) => (
                      <input form={`fq-${c.key}`} name="frequency" value={c.draft.frequency} disabled={closed}
                        onChange={(e) => patch(c.key, { frequency: e.target.value })} placeholder="Ex: 5 x por semana" className={cellInput} />
                    )} />
                    <TextRow label="Mercadoria" cols={cols} closed={closed} render={(c) => (
                      <input form={`fq-${c.key}`} name="cargoDescription" value={c.draft.cargoDescription} disabled={closed}
                        onChange={(e) => patch(c.key, { cargoDescription: e.target.value })} placeholder="Ex: FAK" className={cellInput} />
                    )} />
                    <TextRow label="Volumes" cols={cols} closed={closed} render={(c) => (
                      <input form={`fq-${c.key}`} name="volumes" type="number" min="0" step="1" value={c.draft.volumes} disabled={closed}
                        onChange={(e) => patch(c.key, { volumes: e.target.value })} className={moneyInput} />
                    )} />
                    <TextRow label="Volume (m³)" cols={cols} closed={closed} render={(c) => (
                      <input form={`fq-${c.key}`} name="volumeM3" type="number" step="any" min="0" value={c.draft.volumeM3} disabled={closed}
                        onChange={(e) => patch(c.key, { volumeM3: e.target.value })} className={moneyInput} />
                    )} />
                    <TextRow label="Dimensões" cols={cols} closed={closed} render={(c) => (
                      <input form={`fq-${c.key}`} name="dimensions" value={c.draft.dimensions} disabled={closed}
                        onChange={(e) => patch(c.key, { dimensions: e.target.value })} placeholder="Ex: 120 × 83 × 90 cm" className={cellInput} />
                    )} />
                    <MoneyRow label="Valor da mercadoria" cols={cols} closed={closed}
                      valueName="cargoValue" currencyName="cargoValueCurrency"
                      value={(d) => d.cargoValue} currency={(d) => d.cargoValueCurrency}
                      onValue={(c, v) => patch(c.key, { cargoValue: v })}
                      onCurrency={(c, v) => patch(c.key, { cargoValueCurrency: v })} />
                    <TextRow label="Endereço de coleta" cols={cols} closed={closed} render={(c) => (
                      <input form={`fq-${c.key}`} name="pickupAddress" value={c.draft.pickupAddress} disabled={closed}
                        onChange={(e) => patch(c.key, { pickupAddress: e.target.value })} className={cellInput} />
                    )} />
                    <TextRow label="Arquivo da proposta" cols={cols} closed={closed} render={(c) => (
                      <div className="space-y-1">
                        {c.savedFileName && (
                          <div className="text-xs">
                            {c.quoteId && (
                              <DocumentViewer
                                src={`/api/processos/cotacoes/${c.quoteId}`}
                                fileName={c.savedFileName}
                                className="text-secondary font-semibold break-all"
                              />
                            )}
                            <label className="mt-0.5 flex items-center gap-1 text-[11px] text-on-surface-variant">
                              <input
                                form={`fq-${c.key}`}
                                type="checkbox"
                                name="removeFile"
                                value="1"
                                checked={c.draft.removeFile}
                                onChange={(e) => patch(c.key, { removeFile: e.target.checked })}
                              />
                              remover
                            </label>
                          </div>
                        )}
                        {!closed && (
                          <input
                            key={c.fileNonce}
                            form={`fq-${c.key}`}
                            type="file"
                            name="file"
                            accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv"
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
                    )} />
                  </>
                )}

                {/* AÇÕES */}
                {!closed && (
                  <tr>
                    <th className={labelCell} />
                    {cols.map((c) => {
                      const dirty = JSON.stringify(c.draft) !== c.base;
                      const saving = savingKey === c.key;
                      return (
                        <td key={c.key} colSpan={2} className={`${dataCell} align-top`}>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => save(c)}
                              disabled={saving || (!dirty && c.quoteId !== null)}
                              className="px-3 py-1.5 rounded-lg bg-secondary text-white text-xs font-bold hover:opacity-90 transition-all disabled:opacity-40"
                            >
                              {saving ? "Salvando…" : dirty || c.quoteId === null ? "Salvar" : "Salvo"}
                            </button>
                            {c.quoteId === null ? (
                              <button
                                type="button"
                                onClick={() => setCols((prev) => prev.filter((x) => x.key !== c.key))}
                                className="px-2 py-1.5 rounded-lg text-on-surface-variant text-xs font-bold hover:bg-surface-container-high"
                              >
                                Descartar
                              </button>
                            ) : (
                              <>
                                {c.isSelected ? (
                                  <form action={clearFreightQuoteSelection.bind(null, processId)}>
                                    <button
                                      type="submit"
                                      className="px-2 py-1.5 rounded-lg border border-outline text-primary text-xs font-bold hover:bg-surface-container-high"
                                    >
                                      Desmarcar
                                    </button>
                                  </form>
                                ) : (
                                  <form action={selectFreightQuote.bind(null, c.quoteId, processId)}>
                                    <button
                                      type="submit"
                                      disabled={dirty}
                                      title={dirty ? "Salve as alterações antes de escolher" : undefined}
                                      className="px-2 py-1.5 rounded-lg border border-secondary text-secondary text-xs font-bold hover:bg-secondary/10 disabled:opacity-40"
                                    >
                                      Escolher
                                    </button>
                                  </form>
                                )}
                                <form
                                  action={deleteFreightQuote.bind(null, c.quoteId, processId)}
                                  onSubmit={(e) => {
                                    if (!window.confirm("Remover esta cotação?")) e.preventDefault();
                                  }}
                                >
                                  <button
                                    type="submit"
                                    className="px-2 py-1.5 rounded-lg text-error text-xs font-bold hover:bg-error-container/30"
                                  >
                                    Remover
                                  </button>
                                </form>
                              </>
                            )}
                          </div>
                          {dirty && c.quoteId !== null && (
                            <p className="mt-1 text-[10px] text-warning">Alterações não salvas</p>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="mt-3 text-xs font-bold text-secondary hover:underline"
          >
            {showMore ? "Ocultar dados extras da proposta" : "Mostrar mais dados da proposta (rota, frequência, volumes, valor da mercadoria, coleta, arquivo)"}
          </button>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- auxiliares

const SECTION_BG: Record<string, string> = { CARGA: "#1f9d8f", TAXAS: "#2b7bbf", OUTRAS: "#d86a8a" };

function SectionTag({ section }: { section?: string }) {
  if (!section) return null;
  return (
    <span
      className="mr-2 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
      style={{ background: SECTION_BG[section] }}
    >
      {section}
    </span>
  );
}

function TextRow({
  label,
  cols,
  render,
  section,
}: {
  label: string;
  cols: Col[];
  closed?: boolean;
  render: (c: Col) => ReactNode;
  section?: string;
}) {
  return (
    <tr>
      <th className={labelCell}>
        <SectionTag section={section} />
        {label}
      </th>
      {cols.map((c) => (
        <td key={c.key} colSpan={2} className={dataCell}>
          {render(c)}
        </td>
      ))}
    </tr>
  );
}

function MoneyRow({
  label,
  cols,
  closed,
  section,
  value,
  currency,
  onValue,
  onCurrency,
  valueName,
  currencyName,
}: {
  label: string;
  cols: Col[];
  closed: boolean;
  section?: string;
  value: (d: Draft) => string;
  currency: (d: Draft) => string;
  onValue: (c: Col, v: string) => void;
  onCurrency: (c: Col, v: string) => void;
  valueName?: string;
  currencyName?: string;
}) {
  return (
    <tr>
      <th className={labelCell}>
        <SectionTag section={section} />
        {label}
      </th>
      {cols.map((c) => (
        <Fragment key={c.key}>
          <td className={dataCell}>
            <select
              form={currencyName ? `fq-${c.key}` : undefined}
              name={currencyName}
              value={currency(c.draft)}
              disabled={closed}
              onChange={(e) => onCurrency(c, e.target.value)}
              aria-label={`${label} — moeda`}
              className={`${cellInput} appearance-none text-center`}
            >
              {CURRENCIES.map((m) => (
                <option key={m} value={m}>
                  {m === "OTHER" ? "Outra" : m}
                </option>
              ))}
            </select>
          </td>
          <td className={dataCell}>
            <input
              form={valueName ? `fq-${c.key}` : undefined}
              name={valueName}
              type="number"
              step="any"
              min="0"
              inputMode="decimal"
              value={value(c.draft)}
              disabled={closed}
              onChange={(e) => onValue(c, e.target.value)}
              aria-label={`${label} — custos`}
              placeholder="0,00"
              className={moneyInput}
            />
          </td>
        </Fragment>
      ))}
    </tr>
  );
}

// <form> invisível de uma coluna: guarda os campos que não estão na tabela
// (valores calculados, linhas de custo e dados extras recolhidos).
function ColumnForm({ col, showMore }: { col: Col; showMore: boolean }) {
  const d = col.draft;
  const lines = linesOf(d);
  const hiddenExtras: [string, string][] = showMore
    ? []
    : [
        ["route", d.route],
        ["quoteDate", d.quoteDate],
        ["frequency", d.frequency],
        ["cargoDescription", d.cargoDescription],
        ["volumes", d.volumes],
        ["volumeM3", d.volumeM3],
        ["dimensions", d.dimensions],
        ["cargoValue", d.cargoValue],
        ["cargoValueCurrency", d.cargoValueCurrency],
        ["pickupAddress", d.pickupAddress],
      ];
  return (
    <form id={`fq-${col.key}`} onSubmit={(e) => e.preventDefault()}>
      {hiddenExtras.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {lines.map((l, i) => (
        <Fragment key={i}>
          <input type="hidden" name="lineSection" value={l.section} />
          <input type="hidden" name="lineDescription" value={l.description} />
          <input type="hidden" name="lineQuantity" value={l.quantity} />
          <input type="hidden" name="lineUnitPrice" value={l.unitPrice} />
          <input type="hidden" name="lineUnit" value={l.unit} />
          <input type="hidden" name="lineMinimum" value="" />
          <input type="hidden" name="lineCurrency" value={l.currency} />
          <input type="hidden" name="lineTotal" value={String(l.total)} />
        </Fragment>
      ))}
    </form>
  );
}
