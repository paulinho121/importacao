"use client";

import { Fragment, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  saveFreightQuote,
  deleteFreightQuote,
  selectFreightQuote,
  clearFreightQuoteSelection,
  fetchDailyRate,
  saveFreightQuoteHeader,
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

import SubmitButton from "@/components/SubmitButton";
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
  roadTaxes: Tax[]; // TX DESTINO BLR (transporte rodoviário)
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

const blankTaxes = (n = MAX_TAX_ROWS, currency = "USD"): Tax[] =>
  Array.from({ length: n }, () => ({ name: "", currency, value: "" }));

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
    roadTaxes: blankTaxes(MAX_TAX_ROWS, "BRL"),
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

function taxesFromLines(lines: FreightQuoteLineRow[], blankCurrency = "USD"): Tax[] {
  const taxes: Tax[] = lines.map((l) => ({ name: l.description, currency: l.currency, value: num(l.total) }));
  while (taxes.length < MAX_TAX_ROWS) taxes.push({ name: "", currency: blankCurrency, value: "" });
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
    roadTaxes: taxesFromLines(bySection("RODOVIARIO"), "BRL"),
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
  addTaxes("RODOVIARIO", d.roadTaxes, "TX destino BLR");
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
  "w-full bg-surface-container-low border border-outline-variant/60 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-secondary transition-all";
const moneyInput = `${cellInput} font-mono-data text-right`;
const dataCell = "py-1 px-1.5 align-middle border-t border-l border-outline-variant/40";
const keyCell =
  "sticky z-10 bg-surface-container-lowest px-2 py-1 text-left align-middle text-[11px] font-extrabold uppercase tracking-wide text-on-surface whitespace-nowrap border-t border-outline-variant/40";
const descCell =
  "overflow-hidden text-ellipsis whitespace-nowrap px-2 py-1 align-middle text-[11px] text-on-surface-variant border-t border-outline-variant/40";
const CURRENCIES = ["USD", "BRL", "EUR", "CNY", "GBP", "JPY", "OTHER"];
// Blocos coloridos à esquerda, como na planilha do time.
type SecKey = "GERAIS" | "ROTA" | "CARGA" | "TAXAS" | "TOTAL" | "EXTRAS";
const SEC: Record<SecKey, string> = {
  GERAIS: "#1e5a96",
  ROTA: "#5b6b85",
  CARGA: "#1f9d8f",
  TAXAS: "#2b7bbf",
  TOTAL: "#d99a14",
  EXTRAS: "#7b5ea7",
};

// Larguras fixas: a tabela não estica quando há poucas cotações (campos ficam juntos do rótulo).
const BLOCK_W = 88;
const KEY_W = 128;
const DESC_W = 150;
const LABEL_W = BLOCK_W + KEY_W + DESC_W;
const COL_W = 112 + 66 + 106;
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
  header,
  closed,
}: {
  processId: string;
  quotes: FreightQuoteRow[];
  agents: { id: string; name: string }[];
  processCurrency: string | null;
  exchangeRate: number | null;
  defaults: Defaults;
  header: { number: string; date: string; responsible: string; notes: string };
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
  const [userRows, setUserRows] = useState({ origin: DEFAULT_TAX_ROWS, destination: DEFAULT_TAX_ROWS, road: DEFAULT_TAX_ROWS });
  const [open, setOpen] = useState({ origin: true, destination: true, road: true });
  const toggle = (k: "origin" | "destination" | "road") => setOpen((o) => ({ ...o, [k]: !o[k] }));

  // Cabeçalho da planilha (vale para o processo todo)
  const [hdr, setHdr] = useState(header);
  const [hdrBase, setHdrBase] = useState(JSON.stringify(header));
  const [hdrSaving, setHdrSaving] = useState(false);
  const hdrDirty = JSON.stringify(hdr) !== hdrBase;
  async function saveHeader() {
    setHdrSaving(true);
    try {
      const res = await saveFreightQuoteHeader(processId, hdr);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setHdrBase(JSON.stringify(hdr));
      toast.success("Cabeçalho da cotação salvo.");
    } catch {
      toast.error("Não foi possível salvar o cabeçalho. Tente novamente.");
    } finally {
      setHdrSaving(false);
    }
  }

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

  function patchTax(key: string, field: "originTaxes" | "destinationTaxes" | "roadTaxes", index: number, p: Partial<Tax>) {
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
  // Menor custo (o "verde" da planilha): compara em reais quando todas as cotações
  // convertem; sem o dólar do dia, compara os valores brutos se TODAS estiverem
  // numa única e mesma moeda. Cotações vazias ficam fora.
  const withLines = computed.filter((c) => c.lines.length > 0);
  let compareKeys: (number | null)[] = computed.map(() => null);
  if (withLines.length >= 2 && withLines.every((c) => c.inBRL !== null)) {
    compareKeys = computed.map((c) => (c.lines.length > 0 ? c.inBRL : null));
  } else if (
    withLines.length >= 2 &&
    withLines.every((c) => c.totals.length === 1) &&
    new Set(withLines.map((c) => c.totals[0].currency)).size === 1
  ) {
    compareKeys = computed.map((c) => (c.lines.length > 0 ? c.totals[0].value : null));
  }
  const keyed = compareKeys.filter((v): v is number => v !== null);
  const cheapest = keyed.length >= 2 ? Math.min(...keyed) : null;
  const isCheapest = (i: number) => cheapest !== null && compareKeys[i] === cheapest;
  const isFechada = (c: Col) => c.draft.status === "FECHADO";

  const rowsOrigin = Math.min(
    MAX_TAX_ROWS,
    Math.max(userRows.origin, ...cols.map((c) => lastFilled(c.draft.originTaxes))),
  );
  const rowsDestination = Math.min(
    MAX_TAX_ROWS,
    Math.max(userRows.destination, ...cols.map((c) => lastFilled(c.draft.destinationTaxes))),
  );

  const rowsRoad = Math.min(
    MAX_TAX_ROWS,
    Math.max(userRows.road, ...cols.map((c) => lastFilled(c.draft.roadTaxes))),
  );
  const detail = (isOpen: boolean, n: number) => (isOpen ? n + (!closed && n < MAX_TAX_ROWS ? 1 : 0) : 0);
  // linhas do bloco TAXAS: 3 resumos + DTA + Outros + detalhes abertos
  const taxSpan =
    5 + detail(open.origin, rowsOrigin) + detail(open.destination, rowsDestination) + detail(open.road, rowsRoad);
  // linhas do bloco EXTRAS: observação + (10 dados extras) + (ações)
  const extrasSpan = 1 + (showMore ? 10 : 0) + (closed ? 0 : 1);

  const nCols = cols.length;
  const today = new Date().toISOString().slice(0, 10);
  const F = (c: Col) => `fq-${c.key}`;

  // células que ocupam a coluna inteira da cotação (nome + moeda + custos)
  const fullCells = (render: (c: Col) => ReactNode) =>
    cols.map((c) => (
      <td key={c.key} colSpan={SPAN} className={dataCell}>
        {render(c)}
      </td>
    ));
  // resumo de um grupo de taxas por cotação: "USD 120,00 + BRL 50,00"
  const summaryCells = (section: QuoteSection) =>
    cols.map((c, i) => {
      const totals = totalsByCurrency(computed[i].lines.filter((l) => l.section === section));
      return (
        <td key={c.key} colSpan={SPAN} className={`${dataCell} text-right font-mono-data text-xs font-bold text-primary`}>
          {totals.length === 0 ? (
            <span className="font-normal text-on-surface-variant">—</span>
          ) : (
            totals.map((t) => `${t.currency} ${money(t.value)}`).join(" + ")
          )}
        </td>
      );
    });

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

          <div className="mb-3 grid gap-x-4 gap-y-1.5 rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 md:grid-cols-2">
            <label className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-on-surface">
              <span className="w-28 shrink-0">Cotação Nº</span>
              <input value={hdr.number} disabled={closed} onChange={(e) => setHdr({ ...hdr, number: e.target.value })}
                placeholder="Nº da cotação" className={cellInput} />
            </label>
            <label className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-on-surface">
              <span className="w-28 shrink-0">Data da cotação</span>
              <input type="date" value={hdr.date} disabled={closed} onChange={(e) => setHdr({ ...hdr, date: e.target.value })}
                className={cellInput} />
            </label>
            <label className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-on-surface">
              <span className="w-28 shrink-0">Responsável</span>
              <input value={hdr.responsible} disabled={closed} onChange={(e) => setHdr({ ...hdr, responsible: e.target.value })}
                placeholder="Quem fez a cotação" className={cellInput} />
            </label>
            <label className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-on-surface">
              <span className="w-28 shrink-0">Observações</span>
              <input value={hdr.notes} disabled={closed} onChange={(e) => setHdr({ ...hdr, notes: e.target.value })}
                placeholder="Ex: valores estimados sujeitos a confirmação" className={cellInput} />
            </label>
            {!closed && (
              <div className="md:col-span-2 flex justify-end">
                <button type="button" onClick={saveHeader} disabled={hdrSaving || !hdrDirty}
                  className="px-3 py-1 rounded-lg border border-secondary text-secondary text-xs font-bold hover:bg-secondary/10 disabled:opacity-40">
                  {hdrSaving ? "Salvando…" : hdrDirty ? "Salvar cabeçalho" : "Cabeçalho salvo"}
                </button>
              </div>
            )}
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
            <table
              className="table-fixed border-collapse text-body-sm font-body-sm"
              style={{ width: LABEL_W + nCols * COL_W }}
            >
              <colgroup>
                <col style={{ width: BLOCK_W }} />
                <col style={{ width: KEY_W }} />
                <col style={{ width: DESC_W }} />
                {cols.map((c) => {
                  // sombreado da coluna inteira na cor da empresa; cotação FECHADA fica verde
                  const tint = isFechada(c)
                    ? "#22c55e30"
                    : `${COLORS[c.colorIdx % COLORS.length]}${c.colorIdx % 2 ? "26" : "1a"}`;
                  return (
                    <Fragment key={c.key}>
                      <col style={{ width: 112, background: tint }} />
                      <col style={{ width: 66, background: tint }} />
                      <col style={{ width: 106, background: tint }} />
                    </Fragment>
                  );
                })}
              </colgroup>
              <tbody>
                {/* EMPRESAS (cabeçalho colorido) */}
                <tr>
                  <th
                    colSpan={3}
                    className="sticky left-0 z-10 bg-surface-container-lowest px-2 py-2 text-left align-middle text-[11px] font-extrabold uppercase tracking-wide text-on-surface"
                  >
                    Agente de cargas
                  </th>
                  {cols.map((c) => (
                    <td
                      key={c.key}
                      colSpan={SPAN}
                      className="p-0 border-l border-outline-variant/40"
                      style={{
                        background: COLORS[c.colorIdx % COLORS.length],
                        boxShadow: isFechada(c) ? "inset 0 0 0 3px #22c55e" : undefined,
                      }}
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
                        {isFechada(c) && (
                          <span className="shrink-0 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-black">
                            FECHADA
                          </span>
                        )}
                        {c.isSelected && (
                          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-black">
                            ESCOLHIDA
                          </span>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* DADOS GERAIS */}
                <tr>
                  <Lead sec="GERAIS" name="Dados gerais" span={5} label="Situação" desc="Situação da proposta" />
                  {cols.map((c) => {
                    const st = QUOTE_STATUSES.find((s) => s.value === c.draft.status) ?? QUOTE_STATUSES[0];
                    return (
                      <td key={c.key} colSpan={SPAN} className={dataCell}>
                        <select
                          form={F(c)}
                          name="status"
                          value={c.draft.status}
                          disabled={closed}
                          onChange={(e) => patch(c.key, { status: e.target.value })}
                          aria-label="Situação da cotação"
                          className={`w-full rounded px-2 py-1 text-xs font-bold text-center uppercase appearance-none focus:outline-none ${c.draft.status === "FECHADO" ? "text-black" : "text-white"}`}
                          style={{ background: c.draft.status === "FECHADO" ? "#4ade80" : st.color }}
                        >
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
                <tr>
                  <Lead sec="GERAIS" label="Proposta" desc="Nº da proposta do agente" />
                  {fullCells((c) => (
                    <input form={F(c)} name="proposal" value={c.draft.proposal} disabled={closed}
                      onChange={(e) => patch(c.key, { proposal: e.target.value })}
                      placeholder="Nº da proposta" className={cellInput} />
                  ))}
                </tr>
                <tr>
                  <Lead sec="GERAIS" label="Modal" desc="Modal de transporte" />
                  {fullCells((c) => (
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
                  ))}
                </tr>
                <tr>
                  <Lead sec="GERAIS" label="Tipo" desc="Tipo de embarque" />
                  {fullCells((c) => (
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
                  ))}
                </tr>
                <tr>
                  <Lead sec="GERAIS" label="Incoterm" desc="Termo de comércio" />
                  {fullCells((c) => (
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
                  ))}
                </tr>

                {/* ROTA E PRAZOS */}
                <tr>
                  <Lead sec="ROTA" name="Rota e prazos" span={5} label="Trânsito" desc="Dias de trânsito" />
                  {fullCells((c) => (
                    <div className="flex items-center gap-1">
                      <input form={F(c)} name="transitDays" type="number" min="0" step="1" value={c.draft.transitDays}
                        disabled={closed} onChange={(e) => patch(c.key, { transitDays: e.target.value })}
                        aria-label="Trânsito mínimo" placeholder="de" className={moneyInput} />
                      <span className="text-[11px] text-on-surface-variant">a</span>
                      <input form={F(c)} name="transitDaysMax" type="number" min="0" step="1" value={c.draft.transitDaysMax}
                        disabled={closed} onChange={(e) => patch(c.key, { transitDaysMax: e.target.value })}
                        aria-label="Trânsito máximo" placeholder="até" className={moneyInput} />
                    </div>
                  ))}
                </tr>
                <tr>
                  <Lead sec="ROTA" label="Origem" desc="Aeroporto / porto de origem" />
                  {fullCells((c) => (
                    <input form={F(c)} name="origin" value={c.draft.origin} disabled={closed}
                      onChange={(e) => patch(c.key, { origin: e.target.value })} placeholder="Ex: HKG" className={cellInput} />
                  ))}
                </tr>
                <tr>
                  <Lead sec="ROTA" label="Destino" desc="Aeroporto / porto de destino" />
                  {fullCells((c) => (
                    <input form={F(c)} name="destination" value={c.draft.destination} disabled={closed}
                      onChange={(e) => patch(c.key, { destination: e.target.value })} placeholder="Ex: GRU" className={cellInput} />
                  ))}
                </tr>
                <tr>
                  <Lead sec="ROTA" label="Cia" desc="Companhia aérea / armador" />
                  {fullCells((c) => (
                    <input form={F(c)} name="carrier" value={c.draft.carrier} disabled={closed}
                      onChange={(e) => patch(c.key, { carrier: e.target.value })} placeholder="Ex: Qatar Airways" className={cellInput} />
                  ))}
                </tr>
                <tr>
                  <Lead sec="ROTA" label="Validade" desc="Validade da proposta" />
                  {fullCells((c) => (
                    <>
                      <input form={F(c)} name="validUntil" type="date" value={c.draft.validUntil} disabled={closed}
                        onChange={(e) => patch(c.key, { validUntil: e.target.value })} className={cellInput} />
                      {c.draft.validUntil && c.draft.validUntil < today && (
                        <p className="mt-0.5 text-[10px] font-bold text-error">Proposta vencida</p>
                      )}
                    </>
                  ))}
                </tr>

                {/* CARGA */}
                <tr>
                  <Lead sec="CARGA" name="Carga" span={3} label="Carga (kg)" desc="Peso bruto total" />
                  {fullCells((c) => (
                    <input form={F(c)} name="grossWeightKg" type="number" step="any" min="0" value={c.draft.grossWeightKg}
                      disabled={closed} onChange={(e) => patch(c.key, { grossWeightKg: e.target.value })}
                      className={moneyInput} />
                  ))}
                </tr>
                <tr>
                  <Lead sec="CARGA" label="Frete" desc="Frete internacional (por kg)" />
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
                  <Lead sec="CARGA" label="Carga x Frete" desc="Total carga + frete" />
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

                {/* TAXAS: um resumo por grupo; as taxas por nome abrem logo abaixo */}
                <tr>
                  <Lead sec="TAXAS" name="Taxas" span={taxSpan}
                    label={<GroupToggle label="TX origem" open={open.origin} onClick={() => toggle("origin")} />}
                    desc="Taxa de origem" />
                  {summaryCells("ORIGEM")}
                </tr>
                {open.origin && (
                  <>
                    {Array.from({ length: rowsOrigin }, (_, i) => (
                      <TaxRow key={`o${i}`} index={i} tag="TX origem" cols={cols} closed={closed}
                        taxOf={(c) => c.draft.originTaxes[i] ?? { name: "", currency: "USD", value: "" }}
                        onChange={(c, p) => patchTax(c.key, "originTaxes", i, p)} />
                    ))}
                    {!closed && rowsOrigin < MAX_TAX_ROWS && (
                      <AddRowLine onClick={() => setUserRows((r) => ({ ...r, origin: rowsOrigin + 1 }))} label="+ taxa na origem" />
                    )}
                  </>
                )}

                <tr>
                  <Lead sec="TAXAS" label={<GroupToggle label="TX destino" open={open.destination} onClick={() => toggle("destination")} />}
                    desc="Taxa de destino" />
                  {summaryCells("DESTINO")}
                </tr>
                {open.destination && (
                  <>
                    {Array.from({ length: rowsDestination }, (_, i) => (
                      <TaxRow key={`d${i}`} index={i} tag="TX destino" cols={cols} closed={closed}
                        taxOf={(c) => c.draft.destinationTaxes[i] ?? { name: "", currency: "USD", value: "" }}
                        onChange={(c, p) => patchTax(c.key, "destinationTaxes", i, p)} />
                    ))}
                    {!closed && rowsDestination < MAX_TAX_ROWS && (
                      <AddRowLine onClick={() => setUserRows((r) => ({ ...r, destination: rowsDestination + 1 }))} label="+ taxa no destino" />
                    )}
                  </>
                )}

                <tr>
                  <Lead sec="TAXAS" label={<GroupToggle label="TX destino BLR" open={open.road} onClick={() => toggle("road")} />}
                    desc="Transporte rodoviário" />
                  {summaryCells("RODOVIARIO")}
                </tr>
                {open.road && (
                  <>
                    {Array.from({ length: rowsRoad }, (_, i) => (
                      <TaxRow key={`r${i}`} index={i} tag="TX destino BLR" cols={cols} closed={closed}
                        taxOf={(c) => c.draft.roadTaxes[i] ?? { name: "", currency: "BRL", value: "" }}
                        onChange={(c, p) => patchTax(c.key, "roadTaxes", i, p)} />
                    ))}
                    {!closed && rowsRoad < MAX_TAX_ROWS && (
                      <AddRowLine onClick={() => setUserRows((r) => ({ ...r, road: rowsRoad + 1 }))} label="+ taxa de transporte rodoviário" />
                    )}
                  </>
                )}

                <tr>
                  <Lead sec="TAXAS" label="DTA" desc="Declaração de trânsito" />
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
                  <Lead sec="TAXAS" label="Outros" desc="Custo adicional" />
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

                {/* TOTAL */}
                <tr>
                  <Lead sec="TOTAL" name="Total" span={3} label={`Total ${foreign}`} desc={`Total em ${foreign === "USD" ? "dólares" : foreign}`} />
                  {cols.map((c, i) => (
                    <td key={c.key} colSpan={SPAN}
                      className={`${dataCell} align-top text-right font-mono-data text-sm font-extrabold text-primary ${isCheapest(i) ? "bg-green-500/30" : ""}`}>
                      {isCheapest(i) && (
                        <span className="mb-1 mr-auto block w-fit rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-black">
                          MENOR CUSTO
                        </span>
                      )}
                      {computed[i].inForeign !== null ? (
                        `${foreign} ${money(computed[i].inForeign!)}`
                      ) : computed[i].totals.length === 0 ? (
                        <span className="text-on-surface-variant font-normal">—</span>
                      ) : (
                        <span className="text-[10px] font-normal text-outline">
                          {rate ? "Moedas sem conversão" : "Informe o dólar do dia"}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <Lead sec="TOTAL" label="Total em moeda" desc="Soma por moeda" />
                  {cols.map((c, i) => (
                    <td key={c.key} colSpan={SPAN} className={`${dataCell} align-top ${isCheapest(i) ? "bg-green-500/30" : ""}`}>
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
                <tr>
                  <Lead sec="TOTAL" label="Total BRL" desc="Valor final em reais" />
                  {cols.map((c, i) => (
                    <td key={c.key} colSpan={SPAN} className={`${dataCell} align-top ${isCheapest(i) ? "bg-green-500/30" : ""}`}>
                      {computed[i].inBRL !== null ? (
                        <p className="text-right font-mono-data text-sm font-bold text-primary">
                          {formatMoney(computed[i].inBRL!, "BRL")}
                        </p>
                      ) : (
                        <span className="block text-right text-[10px] text-outline">
                          {computed[i].totals.length === 0 ? "—" : rate ? "Moedas sem conversão" : "Informe o dólar do dia"}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* OBSERVAÇÃO, DADOS EXTRAS E AÇÕES */}
                <tr>
                  <Lead sec="EXTRAS" name="Extras" span={extrasSpan} label="Observação" desc="Ajuste / ressalva" />
                  {fullCells((c) => (
                    <textarea form={F(c)} name="notes" rows={2} value={c.draft.notes} disabled={closed}
                      onChange={(e) => patch(c.key, { notes: e.target.value })}
                      placeholder="Ex: coleta inclusa" className={cellInput} />
                  ))}
                </tr>

                {showMore && (
                  <>
                    <tr>
                      <Lead sec="EXTRAS" label="Rota" desc="Escalas" />
                      {fullCells((c) => (
                        <input form={F(c)} name="route" value={c.draft.route} disabled={closed}
                          onChange={(e) => patch(c.key, { route: e.target.value })} placeholder="Ex: PKE-CDG-GRU" className={cellInput} />
                      ))}
                    </tr>
                    <tr>
                      <Lead sec="EXTRAS" label="Data" desc="Data da cotação" />
                      {fullCells((c) => (
                        <input form={F(c)} name="quoteDate" type="date" value={c.draft.quoteDate} disabled={closed}
                          onChange={(e) => patch(c.key, { quoteDate: e.target.value })} className={cellInput} />
                      ))}
                    </tr>
                    <tr>
                      <Lead sec="EXTRAS" label="Frequência" desc="Saídas por semana" />
                      {fullCells((c) => (
                        <input form={F(c)} name="frequency" value={c.draft.frequency} disabled={closed}
                          onChange={(e) => patch(c.key, { frequency: e.target.value })} placeholder="Ex: 5 x por semana" className={cellInput} />
                      ))}
                    </tr>
                    <tr>
                      <Lead sec="EXTRAS" label="Mercadoria" desc="Descrição da carga" />
                      {fullCells((c) => (
                        <input form={F(c)} name="cargoDescription" value={c.draft.cargoDescription} disabled={closed}
                          onChange={(e) => patch(c.key, { cargoDescription: e.target.value })} placeholder="Ex: FAK" className={cellInput} />
                      ))}
                    </tr>
                    <tr>
                      <Lead sec="EXTRAS" label="Volumes" desc="Quantidade de volumes" />
                      {fullCells((c) => (
                        <input form={F(c)} name="volumes" type="number" min="0" step="1" value={c.draft.volumes} disabled={closed}
                          onChange={(e) => patch(c.key, { volumes: e.target.value })} className={moneyInput} />
                      ))}
                    </tr>
                    <tr>
                      <Lead sec="EXTRAS" label="Volume (m³)" desc="Cubagem" />
                      {fullCells((c) => (
                        <input form={F(c)} name="volumeM3" type="number" step="any" min="0" value={c.draft.volumeM3} disabled={closed}
                          onChange={(e) => patch(c.key, { volumeM3: e.target.value })} className={moneyInput} />
                      ))}
                    </tr>
                    <tr>
                      <Lead sec="EXTRAS" label="Dimensões" desc="Medidas dos volumes" />
                      {fullCells((c) => (
                        <input form={F(c)} name="dimensions" value={c.draft.dimensions} disabled={closed}
                          onChange={(e) => patch(c.key, { dimensions: e.target.value })} placeholder="Ex: 120 × 83 × 90 cm" className={cellInput} />
                      ))}
                    </tr>
                    <tr>
                      <Lead sec="EXTRAS" label="Valor da carga" desc="Valor da mercadoria" />
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
                    <tr>
                      <Lead sec="EXTRAS" label="Coleta" desc="Endereço de coleta" />
                      {fullCells((c) => (
                        <input form={F(c)} name="pickupAddress" value={c.draft.pickupAddress} disabled={closed}
                          onChange={(e) => patch(c.key, { pickupAddress: e.target.value })} className={cellInput} />
                      ))}
                    </tr>
                    <tr>
                      <Lead sec="EXTRAS" label="Arquivo" desc="Arquivo da proposta" />
                      {fullCells((c) => (
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
                      ))}
                    </tr>
                  </>
                )}

                {/* AÇÕES */}
                {!closed && (
                  <tr>
                    <Lead sec="EXTRAS" label="Ações" desc="Salvar a coluna" />
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
                                    <SubmitButton
                                      className="px-2 py-1.5 rounded-lg border border-outline text-primary text-xs font-bold hover:bg-surface-container-high">
                                      Desmarcar
                                    </SubmitButton>
                                  </form>
                                ) : (
                                  <form action={selectFreightQuote.bind(null, c.quoteId, processId)}>
                                    <SubmitButton disabled={dirty}
                                      title={dirty ? "Salve as alterações antes de escolher" : "Escolher e marcar como fechada"}
                                      className="px-2 py-1.5 rounded-lg border border-secondary text-secondary text-xs font-bold hover:bg-secondary/10 disabled:opacity-40">
                                      Escolher
                                    </SubmitButton>
                                  </form>
                                )}
                                <form
                                  action={deleteFreightQuote.bind(null, c.quoteId, processId)}
                                  onSubmit={(e) => {
                                    if (!window.confirm("Remover esta cotação?")) e.preventDefault();
                                  }}
                                >
                                  <SubmitButton
                                    className="px-2 py-1.5 rounded-lg text-error text-xs font-bold hover:bg-error-container/30">
                                    Remover
                                  </SubmitButton>
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

// Células à esquerda de cada linha: bloco colorido da seção (só na 1ª linha,
// com rowSpan), rótulo em negrito e descrição.
function Lead({
  sec,
  name,
  span,
  label,
  desc,
}: {
  sec: SecKey;
  name?: string;
  span?: number;
  label: ReactNode;
  desc?: ReactNode;
}) {
  const color = SEC[sec];
  const band = { backgroundImage: `linear-gradient(${color}1f, ${color}1f)` };
  return (
    <>
      {name !== undefined && (
        <th
          rowSpan={span}
          className="sticky left-0 z-10 border-t border-white/25 px-2 text-center align-middle text-[11px] font-extrabold uppercase leading-tight tracking-wide text-white"
          style={{ background: color }}
        >
          {name}
        </th>
      )}
      <th className={keyCell} style={{ left: BLOCK_W, ...band }}>
        {label}
      </th>
      <td className={descCell} style={band} title={typeof desc === "string" ? desc : undefined}>
        {desc}
      </td>
    </>
  );
}

// Rótulo de um grupo de taxas, com seta para abrir/fechar o detalhe por nome.
function GroupToggle({ label, open, onClick }: { label: string; open: boolean; onClick: () => void }) {
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      title={open ? "Recolher as taxas" : "Detalhar as taxas por nome"}
      className="flex w-full items-center gap-1 text-left uppercase hover:text-secondary"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
    </button>
  );
}

// TX-n: nome da taxa | moeda | custos.
function TaxRow({
  index,
  tag,
  cols,
  closed,
  taxOf,
  onChange,
}: {
  index: number;
  tag: string;
  cols: Col[];
  closed: boolean;
  taxOf: (c: Col) => Tax;
  onChange: (c: Col, p: Partial<Tax>) => void;
}) {
  return (
    <tr>
      <Lead sec="TAXAS" label={<span className="pl-5 text-[10px] font-semibold text-on-surface-variant">TX-{index + 1}</span>} />
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
      <Lead sec="TAXAS" label="" />
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
