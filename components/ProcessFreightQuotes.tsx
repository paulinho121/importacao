"use client";

import { Fragment, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  saveFreightQuote,
  deleteFreightQuote,
  selectFreightQuote,
  clearFreightQuoteSelection,
  fetchDailyRate,
} from "@/app/processos/freight-quotes-actions";
import DocumentViewer from "@/components/DocumentViewer";
import { MODALIDADES, TIPOS_EMBARQUE } from "@/lib/modais";
import { INCOTERMS } from "@/lib/incoterms";
import {
  DEFAULT_TAX_ROWS,
  MAX_TAX_ROWS,
  QUOTE_STATUSES,
  computeLineTotal,
  formatMoney,
  totalInBRL,
  totalInForeign,
  totalsByCurrency,
  type QuoteLineAmount,
  type QuoteSection,
} from "@/lib/freight-quotes";

// Cotações de frete no formato da planilha de comparação do time: uma coluna
// por agente de carga, lado a lado, com nome da taxa | moeda | custos em cada
// linha. Tudo é editável na própria tela e cada coluna é salva separadamente.

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
  modalidade: string | null;
  containerType: string | null;
  status: string;
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

type Defaults = {
  modalidade: string | null;
  containerType: string | null;
  incoterm: string | null;
  weightKg: string | null;
};

// ------------------------------------------------------------ rascunho (coluna)

type Tax = { name: string; currency: string; value: string };

type Draft = {
  agentId: string;
  proposal: string;
  incoterm: string;
  modalidade: string;
  containerType: string;
  status: string;
  transitDays: string;
  transitDaysMax: string;
  origin: string;
  destination: string;
  carrier: string;
  validUntil: string;
  grossWeightKg: string; // "Peso considerado"
  freightRate: string;
  freightCurrency: string;
  originTaxes: Tax[];
  destinationTaxes: Tax[];
  dta: string;
  dtaCurrency: string;
  otherName: string;
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

const blankTaxes = (n = MAX_TAX_ROWS): Tax[] =>
  Array.from({ length: n }, () => ({ name: "", currency: "USD", value: "" }));

const OTHER_DEFAULT_NAME = "Outros custos";

function emptyDraft(d: Defaults): Draft {
  const tipoOk = TIPOS_EMBARQUE.some((t) => t.value === d.containerType);
  return {
    agentId: "",
    proposal: "",
    incoterm: d.incoterm ?? "",
    modalidade: d.modalidade ?? "",
    containerType: tipoOk ? (d.containerType ?? "") : "",
    status: "ATUALIZADO",
    transitDays: "",
    transitDaysMax: "",
    origin: "",
    destination: "",
    carrier: "",
    validUntil: "",
    grossWeightKg: num(d.weightKg),
    freightRate: "",
    freightCurrency: "USD",
    originTaxes: blankTaxes(),
    destinationTaxes: blankTaxes(),
    dta: "",
    dtaCurrency: "BRL",
    otherName: "",
    otherFee: "",
    otherCurrency: "BRL",
    notes: "",
    route: "",
    quoteDate: "",
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

function taxesFromLines(lines: FreightQuoteLineRow[]): Tax[] {
  const taxes: Tax[] = lines.map((l) => ({ name: l.description, currency: l.currency, value: num(l.total) }));
  while (taxes.length < MAX_TAX_ROWS) taxes.push({ name: "", currency: "USD", value: "" });
  return taxes;
}

function draftFromQuote(q: FreightQuoteRow, d: Defaults): Draft {
  const base = emptyDraft(d);
  const bySection = (s: QuoteSection) => q.lines.filter((l) => l.section === s);
  const freight = bySection("FRETE")[0];
  const outras = bySection("OUTRAS");
  const dta = outras.find((l) => /^dta$/i.test(l.description.trim()));
  const other = outras.find((l) => l !== dta);
  return {
    ...base,
    agentId: q.agentId ?? "",
    proposal: q.proposal ?? "",
    incoterm: q.incoterm ?? "",
    modalidade: q.modalidade ?? "",
    containerType: q.containerType ?? "",
    status: q.status,
    transitDays: num(q.transitDays),
    transitDaysMax: num(q.transitDaysMax),
    origin: q.origin ?? "",
    destination: q.destination ?? "",
    carrier: q.carrier ?? "",
    validUntil: q.validUntil ?? "",
    grossWeightKg: num(q.grossWeightKg),
    freightRate: freight ? num(freight.unitPrice ?? freight.total) : "",
    freightCurrency: freight?.currency ?? "USD",
    originTaxes: taxesFromLines(bySection("ORIGEM")),
    destinationTaxes: taxesFromLines(bySection("DESTINO")),
    dta: dta ? num(dta.total) : "",
    dtaCurrency: dta?.currency ?? "BRL",
    otherName: other && other.description !== OTHER_DEFAULT_NAME ? other.description : "",
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

// Frete = peso considerado × tarifa por kg; sem peso informado, a tarifa é
// tratada como valor total (frete fechado).
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
  const addTaxes = (section: QuoteSection, taxes: Tax[], label: string) => {
    taxes.forEach((t, i) => {
      const n = toNumber(t.value);
      if (n === null) return;
      out.push({
        section,
        description: t.name.trim() || `${label} ${i + 1}`,
        quantity: "",
        unitPrice: "",
        unit: "",
        currency: t.currency,
        total: n,
      });
    });
  };
  addTaxes("ORIGEM", d.originTaxes, "TX origem");
  addTaxes("DESTINO", d.destinationTaxes, "TX destino");
  const dta = toNumber(d.dta);
  if (dta !== null) {
    out.push({ section: "OUTRAS", description: "DTA", quantity: "", unitPrice: "", unit: "", currency: d.dtaCurrency, total: dta });
  }
  const other = toNumber(d.otherFee);
  if (other !== null) {
    out.push({
      section: "OUTRAS",
      description: d.otherName.trim() || OTHER_DEFAULT_NAME,
      quantity: "",
      unitPrice: "",
      unit: "",
      currency: d.otherCurrency,
      total: other,
    });
  }
  return out;
}

const lastFilled = (taxes: Tax[]) => {
  for (let i = taxes.length - 1; i >= 0; i--) if (taxes[i].name.trim() || taxes[i].value.trim()) return i + 1;
  return 0;
};

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
const SECTION_BG: Record<string, string> = { CARGA: "#1f9d8f", ORIGEM: "#2b7bbf", DESTINO: "#7b5ea7", OUTROS: "#d86a8a" };

const SPAN = 3; // subcolunas por cotação: nome | moeda | custos

const money = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function CurrencySelect({
  value,
  onChange,
  disabled,
  label,
  name,
  form,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  label: string;
  name?: string;
  form?: string;
}) {
  return (
    <select
      form={form}
      name={name}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={`${cellInput} appearance-none text-center`}
    >
      {CURRENCIES.map((m) => (
        <option key={m} value={m}>
          {m === "OTHER" ? "Outra" : m}
        </option>
      ))}
    </select>
  );
}

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
  const [userRows, setUserRows] = useState({ origin: DEFAULT_TAX_ROWS, destination: DEFAULT_TAX_ROWS });

  // Moeda estrangeira da comparação e o câmbio ("dólar do dia"), só para
  // comparar as cotações: não altera o câmbio salvo no processo.
  const foreign = processCurrency && processCurrency !== "BRL" && processCurrency !== "OTHER" ? processCurrency : "USD";
  const [rateText, setRateText] = useState(exchangeRate && foreign === processCurrency ? String(exchangeRate) : "");
  const [rateNote, setRateNote] = useState<string | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const rate = toNumber(rateText);

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
      for (const c of prev) if (c.quoteId === null) next.push({ ...c });
      return next.map((c, i) => ({ ...c, colorIdx: i }));
    });
  }

  function patch(key: string, p: Partial<Draft>) {
    setCols((prev) => prev.map((c) => (c.key === key ? { ...c, draft: { ...c.draft, ...p } } : c)));
  }

  function patchTax(key: string, field: "originTaxes" | "destinationTaxes", index: number, p: Partial<Tax>) {
    setCols((prev) =>
      prev.map((c) => {
        if (c.key !== key) return c;
        const taxes = c.draft[field].map((t, i) => (i === index ? { ...t, ...p } : t));
        return { ...c, draft: { ...c.draft, [field]: taxes } };
      }),
    );
  }

  function addColumn() {
    const key = `new-${++seq}`;
    const draft = emptyDraft(defaults);
    setCols((prev) => [
      ...prev,
      {
        key,
        quoteId: null,
        savedFileName: null,
        isSelected: false,
        draft,
        base: JSON.stringify(draft),
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

  async function loadRate() {
    setRateLoading(true);
    try {
      const res = await fetchDailyRate(foreign);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRateText(String(res.rate));
      setRateNote(`PTAX de venda de ${res.date.split("-").reverse().join("/")}`);
    } catch {
      toast.error("Não foi possível buscar o câmbio agora.");
    } finally {
      setRateLoading(false);
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
      inForeign: lines.length > 0 ? totalInForeign(lines, foreign, rate) : null,
      inBRL: lines.length > 0 ? totalInBRL(lines, foreign, rate) : null,
    };
  });
  const comparable = computed.map((c) => c.inBRL).filter((v): v is number => v !== null);
  const cheapest = comparable.length >= 2 ? Math.min(...comparable) : null;

  const rowsOrigin = Math.min(
    MAX_TAX_ROWS,
    Math.max(userRows.origin, ...cols.map((c) => lastFilled(c.draft.originTaxes))),
  );
  const rowsDestination = Math.min(
    MAX_TAX_ROWS,
    Math.max(userRows.destination, ...cols.map((c) => lastFilled(c.draft.destinationTaxes))),
  );

  const nCols = cols.length;
  const today = new Date().toISOString().slice(0, 10);
  const F = (c: Col) => `fq-${c.key}`;

  return (
    <section className="bg-surface-container-lowest border border-outline-variant p-gutter rounded-xl shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-stack-md">
        <div>
          <h3 className="font-headline-sm text-headline-sm text-primary">Cotações de Frete</h3>
          <p className="text-xs text-on-surface-variant">
            Uma coluna por agente de carga, como na planilha. Preencha, e clique em Salvar na coluna. Ao escolher uma
            cotação, o agente e o frete (+ taxas de origem) vão para o processo.
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

          <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg bg-surface-container-low px-3 py-2">
            <label className="text-xs text-on-surface-variant">
              <span className="block mb-0.5">
                Dólar do dia — R$ por {foreign} (para somar em reais)
              </span>
              <input
                type="number"
                step="any"
                min="0"
                value={rateText}
                onChange={(e) => {
                  setRateText(e.target.value);
                  setRateNote(null);
                }}
                placeholder="Ex: 5,48"
                className={`${moneyInput} w-32`}
              />
            </label>
            <button
              type="button"
              onClick={loadRate}
              disabled={rateLoading}
              className="px-3 py-1.5 rounded-lg border border-outline text-primary text-xs font-bold hover:bg-surface-container-high disabled:opacity-50"
            >
              {rateLoading ? "Buscando…" : `Buscar ${foreign} do dia`}
            </button>
            <span className="text-[11px] text-on-surface-variant">
              {rateNote ?? "Usado só para comparar as cotações; não altera o câmbio do processo."}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="border-collapse text-body-sm font-body-sm min-w-full">
              <colgroup>
                <col style={{ width: 160 }} />
                {cols.map((c) => (
                  <Fragment key={c.key}>
                    <col style={{ width: 112 }} />
                    <col style={{ width: 66 }} />
                    <col style={{ width: 106 }} />
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
                      colSpan={SPAN}
                      className="p-0 border-l border-outline-variant/40"
                      style={{ background: COLORS[c.colorIdx % COLORS.length] }}
                    >
                      <div className="flex items-center gap-1 px-1.5 py-1.5">
                        <select
                          form={F(c)}
                          name="agentId"
                          value={c.draft.agentId}
                          disabled={closed}
                          onChange={(e) => patch(c.key, { agentId: e.target.value })}
                          aria-label="Agente de carga"
                          className="w-full bg-transparent text-white font-bold text-xs uppercase focus:outline-none cursor-pointer"
                        >
                          <option value="" className="text-black">
                            Nome — selecione o agente
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

                <FullRow label="Proposta" cols={cols} render={(c) => (
                  <input form={F(c)} name="proposal" value={c.draft.proposal} disabled={closed}
                    onChange={(e) => patch(c.key, { proposal: e.target.value })}
                    placeholder="Nº da proposta" className={cellInput} />
                )} />
                <FullRow label="Incoterm" cols={cols} render={(c) => (
                  <select form={F(c)} name="incoterm" value={c.draft.incoterm} disabled={closed}
                    onChange={(e) => patch(c.key, { incoterm: e.target.value })}
                    className={`${cellInput} appearance-none`}>
                    <option value="">EXW, FOB, CIF…</option>
                    {INCOTERMS.map((t) => (
                      <option key={t} value={t}>
                        {t.split(" - ")[0]}
                      </option>
                    ))}
                  </select>
                )} />
                <FullRow label="Modal" cols={cols} render={(c) => (
                  <select form={F(c)} name="modalidade" value={c.draft.modalidade} disabled={closed}
                    onChange={(e) => {
                      const m = e.target.value;
                      const tipoOk = TIPOS_EMBARQUE.some((t) => t.value === c.draft.containerType && t.modalidade === m);
                      patch(c.key, { modalidade: m, containerType: tipoOk ? c.draft.containerType : "" });
                    }}
                    className={`${cellInput} appearance-none`}>
                    <option value="">Marítimo / Aéreo…</option>
                    {MODALIDADES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                )} />
                <FullRow label="Tipo" cols={cols} render={(c) => (
                  <select form={F(c)} name="containerType" value={c.draft.containerType} disabled={closed}
                    onChange={(e) => {
                      const t = TIPOS_EMBARQUE.find((x) => x.value === e.target.value);
                      patch(c.key, { containerType: e.target.value, modalidade: t ? t.modalidade : c.draft.modalidade });
                    }}
                    className={`${cellInput} appearance-none`}>
                    <option value="">FCL, LCL…</option>
                    {TIPOS_EMBARQUE.filter((t) => !c.draft.modalidade || t.modalidade === c.draft.modalidade).map((t) => (
                      <option key={`${t.modalidade}-${t.value}`} value={t.value}>
                        {t.value}
                      </option>
                    ))}
                  </select>
                )} />

                {/* INFORMAÇÕES */}
                <FullRow label="Trânsito (dias)" cols={cols} render={(c) => (
                  <div className="flex items-center gap-1">
                    <input form={F(c)} name="transitDays" type="number" min="0" step="1" value={c.draft.transitDays}
                      disabled={closed} onChange={(e) => patch(c.key, { transitDays: e.target.value })}
                      aria-label="Trânsito mínimo" placeholder="de" className={moneyInput} />
                    <span className="text-[11px] text-on-surface-variant">a</span>
                    <input form={F(c)} name="transitDaysMax" type="number" min="0" step="1" value={c.draft.transitDaysMax}
                      disabled={closed} onChange={(e) => patch(c.key, { transitDaysMax: e.target.value })}
                      aria-label="Trânsito máximo" placeholder="até" className={moneyInput} />
                  </div>
                )} />
                <FullRow label="Origem" cols={cols} render={(c) => (
                  <input form={F(c)} name="origin" value={c.draft.origin} disabled={closed}
                    onChange={(e) => patch(c.key, { origin: e.target.value })} placeholder="Ex: HKG" className={cellInput} />
                )} />
                <FullRow label="Destino" cols={cols} render={(c) => (
                  <input form={F(c)} name="destination" value={c.draft.destination} disabled={closed}
                    onChange={(e) => patch(c.key, { destination: e.target.value })} placeholder="Ex: GRU" className={cellInput} />
                )} />
                <FullRow label="Cia" cols={cols} render={(c) => (
                  <input form={F(c)} name="carrier" value={c.draft.carrier} disabled={closed}
                    onChange={(e) => patch(c.key, { carrier: e.target.value })} placeholder="Ex: Qatar Airways" className={cellInput} />
                )} />
                <FullRow label="Validade da proposta" cols={cols} render={(c) => (
                  <>
                    <input form={F(c)} name="validUntil" type="date" value={c.draft.validUntil} disabled={closed}
                      onChange={(e) => patch(c.key, { validUntil: e.target.value })} className={cellInput} />
                    {c.draft.validUntil && c.draft.validUntil < today && (
                      <p className="mt-0.5 text-[10px] font-bold text-error">Proposta vencida</p>
                    )}
                  </>
                )} />

                {/* CARGA */}
                <FullRow label="Peso considerado (kg)" tag="CARGA" cols={cols} render={(c) => (
                  <input form={F(c)} name="grossWeightKg" type="number" step="any" min="0" value={c.draft.grossWeightKg}
                    disabled={closed} onChange={(e) => patch(c.key, { grossWeightKg: e.target.value })}
                    className={moneyInput} />
                )} />
                <tr>
                  <th className={labelCell}>Frete (kg / moeda)</th>
                  {cols.map((c) => (
                    <Fragment key={c.key}>
                      <td className={`${dataCell} text-[11px] text-on-surface-variant text-center`}>por kg</td>
                      <td className={dataCell}>
                        <CurrencySelect value={c.draft.freightCurrency} disabled={closed} label="Frete — moeda"
                          onChange={(v) => patch(c.key, { freightCurrency: v })} />
                      </td>
                      <td className={dataCell}>
                        <input type="number" step="any" min="0" inputMode="decimal" value={c.draft.freightRate}
                          disabled={closed} onChange={(e) => patch(c.key, { freightRate: e.target.value })}
                          aria-label="Frete — tarifa" placeholder="0,00" className={moneyInput} />
                      </td>
                    </Fragment>
                  ))}
                </tr>
                <tr>
                  <th className={labelCell}>Carga × Frete</th>
                  {cols.map((c) => {
                    const total = freightTotal(c.draft);
                    const kg = toNumber(c.draft.grossWeightKg);
                    return (
                      <Fragment key={c.key}>
                        <td className={`${dataCell} text-[11px] text-on-surface-variant text-center`}>
                          {total !== null ? (kg ? `${kg} kg × ${c.draft.freightRate}` : "valor fechado") : ""}
                        </td>
                        <td className={`${dataCell} text-center text-xs font-bold`}>
                          {total !== null ? c.draft.freightCurrency : ""}
                        </td>
                        <td className={`${dataCell} text-right font-mono-data font-bold text-xs`}>
                          {total !== null ? money(total) : "—"}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>

                {/* CABEÇALHO DAS TAXAS: "1 - EMPRESA" */}
                <tr>
                  <th className={labelCell} />
                  {cols.map((c, i) => (
                    <td key={c.key} colSpan={SPAN} className={`${dataCell} text-center text-xs font-bold`}>
                      {i + 1} - {agents.find((a) => a.id === c.draft.agentId)?.name ?? "Empresa"}
                    </td>
                  ))}
                </tr>

                {/* TX ORIGEM */}
                {Array.from({ length: rowsOrigin }, (_, i) => (
                  <TaxRow key={`o${i}`} index={i} tag="TX ORIGEM" tagBg={SECTION_BG.ORIGEM} cols={cols} closed={closed}
                    taxOf={(c) => c.draft.originTaxes[i] ?? { name: "", currency: "USD", value: "" }}
                    onChange={(c, p) => patchTax(c.key, "originTaxes", i, p)} />
                ))}
                {!closed && rowsOrigin < MAX_TAX_ROWS && (
                  <AddRowLine onClick={() => setUserRows((r) => ({ ...r, origin: rowsOrigin + 1 }))} label="+ taxa na origem" />
                )}

                {/* TX DESTINO */}
                {Array.from({ length: rowsDestination }, (_, i) => (
                  <TaxRow key={`d${i}`} index={i} tag="TX DESTINO" tagBg={SECTION_BG.DESTINO} cols={cols} closed={closed}
                    taxOf={(c) => c.draft.destinationTaxes[i] ?? { name: "", currency: "USD", value: "" }}
                    onChange={(c, p) => patchTax(c.key, "destinationTaxes", i, p)} />
                ))}
                {!closed && rowsDestination < MAX_TAX_ROWS && (
                  <AddRowLine onClick={() => setUserRows((r) => ({ ...r, destination: rowsDestination + 1 }))} label="+ taxa no destino" />
                )}

                {/* DTA e OUTROS CUSTOS */}
                <tr>
                  <th className={labelCell}>
                    <Tag bg={SECTION_BG.OUTROS}>OUTROS</Tag>
                    DTA
                  </th>
                  {cols.map((c) => (
                    <Fragment key={c.key}>
                      <td className={dataCell} />
                      <td className={dataCell}>
                        <CurrencySelect value={c.draft.dtaCurrency} disabled={closed} label="DTA — moeda"
                          onChange={(v) => patch(c.key, { dtaCurrency: v })} />
                      </td>
                      <td className={dataCell}>
                        <input type="number" step="any" min="0" inputMode="decimal" value={c.draft.dta} disabled={closed}
                          onChange={(e) => patch(c.key, { dta: e.target.value })} aria-label="DTA — custos"
                          placeholder="0,00" className={moneyInput} />
                      </td>
                    </Fragment>
                  ))}
                </tr>
                <tr>
                  <th className={labelCell}>Outros custos</th>
                  {cols.map((c) => (
                    <Fragment key={c.key}>
                      <td className={dataCell}>
                        <input value={c.draft.otherName} disabled={closed}
                          onChange={(e) => patch(c.key, { otherName: e.target.value })}
                          aria-label="Outros custos — descrição" placeholder="Qual custo?" className={cellInput} />
                      </td>
                      <td className={dataCell}>
                        <CurrencySelect value={c.draft.otherCurrency} disabled={closed} label="Outros custos — moeda"
                          onChange={(v) => patch(c.key, { otherCurrency: v })} />
                      </td>
                      <td className={dataCell}>
                        <input type="number" step="any" min="0" inputMode="decimal" value={c.draft.otherFee} disabled={closed}
                          onChange={(e) => patch(c.key, { otherFee: e.target.value })} aria-label="Outros custos — custos"
                          placeholder="0,00" className={moneyInput} />
                      </td>
                    </Fragment>
                  ))}
                </tr>
                <FullRow label="Observação / ajuste" cols={cols} render={(c) => (
                  <textarea form={F(c)} name="notes" rows={2} value={c.draft.notes} disabled={closed}
                    onChange={(e) => patch(c.key, { notes: e.target.value })}
                    placeholder="Ex: coleta inclusa" className={cellInput} />
                )} />

                {/* SITUAÇÃO: ATUALIZADO / ANTIGO / FECHADO */}
                <tr>
                  <th className={labelCell}>Situação</th>
                  {cols.map((c) => {
                    const st = QUOTE_STATUSES.find((s) => s.value === c.draft.status) ?? QUOTE_STATUSES[0];
                    return (
                      <td key={c.key} colSpan={SPAN} className={dataCell}>
                        <select form={F(c)} name="status" value={c.draft.status} disabled={closed}
                          onChange={(e) => patch(c.key, { status: e.target.value })}
                          aria-label="Situação da cotação"
                          className="w-full rounded px-2 py-1 text-xs font-bold text-white text-center uppercase appearance-none focus:outline-none"
                          style={{ background: st.color }}>
                          {QUOTE_STATUSES.map((s) => (
                            <option key={s.value} value={s.value} className="text-black">
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>

                {/* CUSTOS ESTIMADOS */}
                <tr className="bg-surface-container-high/60">
                  <th className={`${labelCell} text-primary font-bold`}>Custo estimado em moeda</th>
                  {cols.map((c, i) => (
                    <td key={c.key} colSpan={SPAN} className={`${dataCell} align-top`}>
                      {computed[i].totals.length === 0 ? (
                        <span className="text-on-surface-variant">—</span>
                      ) : (
                        computed[i].totals.map((t) => (
                          <p key={t.currency} className="flex justify-between gap-2 font-mono-data font-bold text-primary text-xs">
                            <span>{t.currency}</span>
                            <span>{money(t.value)}</span>
                          </p>
                        ))
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="bg-surface-container-high/60">
                  <th className={`${labelCell} text-primary font-bold`}>
                    Custo estimado em {foreign}
                    <span className="block text-[10px] font-normal text-on-surface-variant">considerando o dólar do dia</span>
                  </th>
                  {cols.map((c, i) => (
                    <td key={c.key} colSpan={SPAN} className={`${dataCell} text-right font-mono-data text-xs font-bold text-primary`}>
                      {computed[i].inForeign !== null ? (
                        `${foreign} ${money(computed[i].inForeign!)}`
                      ) : (
                        <span className="text-[10px] font-normal text-outline">
                          {rate ? "Moedas sem conversão" : "Informe o dólar do dia"}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="bg-surface-container-high/60">
                  <th className={`${labelCell} text-primary font-bold`}>Valor final em BRL</th>
                  {cols.map((c, i) => (
                    <td key={c.key} colSpan={SPAN} className={`${dataCell} align-top`}>
                      {computed[i].inBRL !== null ? (
                        <>
                          <p className="text-right font-mono-data text-sm font-bold text-primary">
                            {formatMoney(computed[i].inBRL!, "BRL")}
                          </p>
                          {cheapest !== null && computed[i].inBRL === cheapest && (
                            <span className="mt-1 inline-block rounded-full bg-tertiary-fixed px-2 py-0.5 text-[10px] font-bold text-on-tertiary-fixed-variant">
                              Menor custo
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="block text-right text-[10px] text-outline">
                          {computed[i].totals.length === 0 ? "—" : rate ? "Moedas sem conversão" : "Informe o dólar do dia"}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* MAIS DADOS DA PROPOSTA */}
                {showMore && (
                  <>
                    <FullRow label="Rota (escalas)" cols={cols} render={(c) => (
                      <input form={F(c)} name="route" value={c.draft.route} disabled={closed}
                        onChange={(e) => patch(c.key, { route: e.target.value })} placeholder="Ex: PKE-CDG-GRU" className={cellInput} />
                    )} />
                    <FullRow label="Data da cotação" cols={cols} render={(c) => (
                      <input form={F(c)} name="quoteDate" type="date" value={c.draft.quoteDate} disabled={closed}
                        onChange={(e) => patch(c.key, { quoteDate: e.target.value })} className={cellInput} />
                    )} />
                    <FullRow label="Frequência" cols={cols} render={(c) => (
                      <input form={F(c)} name="frequency" value={c.draft.frequency} disabled={closed}
                        onChange={(e) => patch(c.key, { frequency: e.target.value })} placeholder="Ex: 5 x por semana" className={cellInput} />
                    )} />
                    <FullRow label="Mercadoria" cols={cols} render={(c) => (
                      <input form={F(c)} name="cargoDescription" value={c.draft.cargoDescription} disabled={closed}
                        onChange={(e) => patch(c.key, { cargoDescription: e.target.value })} placeholder="Ex: FAK" className={cellInput} />
                    )} />
                    <FullRow label="Volumes" cols={cols} render={(c) => (
                      <input form={F(c)} name="volumes" type="number" min="0" step="1" value={c.draft.volumes} disabled={closed}
                        onChange={(e) => patch(c.key, { volumes: e.target.value })} className={moneyInput} />
                    )} />
                    <FullRow label="Volume (m³)" cols={cols} render={(c) => (
                      <input form={F(c)} name="volumeM3" type="number" step="any" min="0" value={c.draft.volumeM3} disabled={closed}
                        onChange={(e) => patch(c.key, { volumeM3: e.target.value })} className={moneyInput} />
                    )} />
                    <FullRow label="Dimensões" cols={cols} render={(c) => (
                      <input form={F(c)} name="dimensions" value={c.draft.dimensions} disabled={closed}
                        onChange={(e) => patch(c.key, { dimensions: e.target.value })} placeholder="Ex: 120 × 83 × 90 cm" className={cellInput} />
                    )} />
                    <tr>
                      <th className={labelCell}>Valor da mercadoria</th>
                      {cols.map((c) => (
                        <Fragment key={c.key}>
                          <td className={dataCell} />
                          <td className={dataCell}>
                            <CurrencySelect form={F(c)} name="cargoValueCurrency" value={c.draft.cargoValueCurrency}
                              disabled={closed} label="Valor da mercadoria — moeda"
                              onChange={(v) => patch(c.key, { cargoValueCurrency: v })} />
                          </td>
                          <td className={dataCell}>
                            <input form={F(c)} name="cargoValue" type="number" step="any" min="0" value={c.draft.cargoValue}
                              disabled={closed} onChange={(e) => patch(c.key, { cargoValue: e.target.value })}
                              aria-label="Valor da mercadoria" className={moneyInput} />
                          </td>
                        </Fragment>
                      ))}
                    </tr>
                    <FullRow label="Endereço de coleta" cols={cols} render={(c) => (
                      <input form={F(c)} name="pickupAddress" value={c.draft.pickupAddress} disabled={closed}
                        onChange={(e) => patch(c.key, { pickupAddress: e.target.value })} className={cellInput} />
                    )} />
                    <FullRow label="Arquivo da proposta" cols={cols} render={(c) => (
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
                              <input form={F(c)} type="checkbox" name="removeFile" value="1" checked={c.draft.removeFile}
                                onChange={(e) => patch(c.key, { removeFile: e.target.checked })} />
                              remover
                            </label>
                          </div>
                        )}
                        {!closed && (
                          <input
                            key={c.fileNonce}
                            form={F(c)}
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
                        <td key={c.key} colSpan={SPAN} className={`${dataCell} align-top`}>
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
                                    <button type="submit"
                                      className="px-2 py-1.5 rounded-lg border border-outline text-primary text-xs font-bold hover:bg-surface-container-high">
                                      Desmarcar
                                    </button>
                                  </form>
                                ) : (
                                  <form action={selectFreightQuote.bind(null, c.quoteId, processId)}>
                                    <button type="submit" disabled={dirty}
                                      title={dirty ? "Salve as alterações antes de escolher" : "Escolher e marcar como fechada"}
                                      className="px-2 py-1.5 rounded-lg border border-secondary text-secondary text-xs font-bold hover:bg-secondary/10 disabled:opacity-40">
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
                                  <button type="submit"
                                    className="px-2 py-1.5 rounded-lg text-error text-xs font-bold hover:bg-error-container/30">
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
            {showMore
              ? "Ocultar dados extras da proposta"
              : "Mostrar mais dados da proposta (rota, frequência, volumes, valor da mercadoria, coleta, arquivo)"}
          </button>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- auxiliares

function Tag({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <span
      className="mr-2 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
      style={{ background: bg }}
    >
      {children}
    </span>
  );
}

// Linha cujo conteúdo ocupa a coluna inteira da cotação (nome + moeda + custos).
function FullRow({
  label,
  cols,
  render,
  tag,
}: {
  label: string;
  cols: Col[];
  render: (c: Col) => ReactNode;
  tag?: string;
}) {
  return (
    <tr>
      <th className={labelCell}>
        {tag && <Tag bg={SECTION_BG[tag] ?? "#1f9d8f"}>{tag}</Tag>}
        {label}
      </th>
      {cols.map((c) => (
        <td key={c.key} colSpan={SPAN} className={dataCell}>
          {render(c)}
        </td>
      ))}
    </tr>
  );
}

// TX-n: nome da taxa | moeda | custos.
function TaxRow({
  index,
  tag,
  tagBg,
  cols,
  closed,
  taxOf,
  onChange,
}: {
  index: number;
  tag: string;
  tagBg: string;
  cols: Col[];
  closed: boolean;
  taxOf: (c: Col) => Tax;
  onChange: (c: Col, p: Partial<Tax>) => void;
}) {
  return (
    <tr>
      <th className={labelCell}>
        {index === 0 && <Tag bg={tagBg}>{tag}</Tag>}
        <span className={index === 0 ? "" : "pl-1 text-[11px] font-normal"}>TX-{index + 1}</span>
      </th>
      {cols.map((c) => {
        const t = taxOf(c);
        return (
          <Fragment key={c.key}>
            <td className={dataCell}>
              <input value={t.name} disabled={closed} onChange={(e) => onChange(c, { name: e.target.value })}
                aria-label={`${tag} TX-${index + 1} — nome`} placeholder={`TX-${index + 1}`} className={cellInput} />
            </td>
            <td className={dataCell}>
              <CurrencySelect value={t.currency} disabled={closed} label={`${tag} TX-${index + 1} — moeda`}
                onChange={(v) => onChange(c, { currency: v })} />
            </td>
            <td className={dataCell}>
              <input type="number" step="any" min="0" inputMode="decimal" value={t.value} disabled={closed}
                onChange={(e) => onChange(c, { value: e.target.value })} aria-label={`${tag} TX-${index + 1} — custos`}
                placeholder="0,00" className={moneyInput} />
            </td>
          </Fragment>
        );
      })}
    </tr>
  );
}

function AddRowLine({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <tr>
      <th className={labelCell} />
      <td colSpan={999} className="border-t border-outline-variant/40 py-1 pl-2">
        <button type="button" onClick={onClick} className="text-[11px] font-bold text-secondary hover:underline">
          {label}
        </button>
      </td>
    </tr>
  );
}

// <form> invisível de uma coluna: guarda os campos que não estão na tabela
// (linhas de custo calculadas e dados extras recolhidos).
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
