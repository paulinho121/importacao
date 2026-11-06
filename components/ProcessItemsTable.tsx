"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  addItemReservation,
  removeProcessItem,
  updateProcessItem,
  updateProcessItemValue,
} from "@/app/processos/actions";
import DeleteExternalImportItemButton from "@/components/DeleteExternalImportItemButton";
import { ItemPhoto, LpcoUfChips, type ItemLpco } from "@/components/ItemStatus";
import { CP_LIST_RESULT_LABEL, type CpListResult } from "@/lib/cp-list";
import { BRANCHES } from "@/lib/locations";
import { LPCO_TONE_CLASS, lpcoCountdown, lpcoTone, lpcoValidUntil, productLpcoStatusLabel } from "@/lib/lpco";
import { CP_STATUS_OPTIONS, hasPublicConsultation } from "@/lib/product-flow";
import { formatDate, stockStatus } from "@/lib/status";

import SubmitButton from "@/components/SubmitButton";
export type ProcessItemRow = {
  id: string;
  productId: string | null;
  description: string;
  sku: string | null;
  manufacturerSku: string | null;
  photoUrl: string | null;
  ncm: string | null;
  quantity: string | null;
  unitValue: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  exchangeCoverage: boolean | null;
  lpcoPublicConsultation: boolean | null;
  lpcoNumber: string | null;
  reservedTo: string | null;
  poLabel: string | null;
  cpStatus: string | null;
  cpListResult: string | null;
  cpListRef: string | null;
  lpcos: ItemLpco[];
  reservations: { id: string; personName: string; quantity: string; observation: string | null }[];
};

type BenefitKind = "com" | "sem" | "nacional" | "conferir" | "solicitada" | "naoVerificada" | "avulso";
type Filter = "todos" | "com" | "sem" | "verificar";

// Veredito da consulta pública (CP) do item: tem benefício ou não.
function benefitOf(r: ProcessItemRow): { kind: BenefitKind; label: string; detail: string | null; className: string } {
  if (!r.productId) {
    return { kind: "avulso", label: "Item avulso", detail: "sem cadastro de produto", className: LPCO_TONE_CLASS.none };
  }
  if (hasPublicConsultation({ cpStatus: r.cpStatus, cpListResult: r.cpListResult })) {
    return {
      kind: "com",
      label: "Com benefício",
      detail: r.cpListRef ? `CP ${r.cpListRef}` : "consulta pública já possui",
      className: LPCO_TONE_CLASS.ok,
    };
  }
  if (r.cpListResult === "FOUND_NATIONAL") {
    return { kind: "nacional", label: "Fabricante nacional", detail: r.cpListRef ? `CP ${r.cpListRef}` : null, className: "bg-warning/20 text-warning" };
  }
  if (r.cpListResult === "FOUND_APPROX") {
    return { kind: "conferir", label: "Conferir", detail: "possível correspondência na lista", className: "bg-secondary-fixed text-on-secondary-fixed-variant" };
  }
  if (r.cpStatus === "SOLICITADA") {
    return { kind: "solicitada", label: "CP solicitada", detail: "em acompanhamento", className: "bg-warning/20 text-warning" };
  }
  if (r.cpStatus === "NAO_POSSUI") {
    return { kind: "sem", label: "Sem benefício", detail: "precisa solicitar a CP", className: "bg-error-container text-on-error-container" };
  }
  return { kind: "naoVerificada", label: "Não verificada", detail: "consulta pública pendente", className: LPCO_TONE_CLASS.none };
}

const GROUP_OF: Record<BenefitKind, Exclude<Filter, "todos">> = {
  com: "com",
  sem: "sem",
  nacional: "sem",
  conferir: "verificar",
  solicitada: "verificar",
  naoVerificada: "verificar",
  avulso: "verificar",
};

const num = (v: string | null) => (v ? Number(v) : 0);
const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtQty = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n);

const INPUT =
  "w-full rounded-lg border border-outline-variant bg-surface-container-low p-2 text-xs focus:border-secondary focus:outline-none transition-all";
const SAVE_BTN = "rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold text-white transition-all hover:opacity-90";

function Label({ children }: { children: ReactNode }) {
  return <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant lg:hidden">{children}</span>;
}

// Detalhes do item (abre ao clicar na linha): edição, benefício por estado e reservas.
function ItemPanel({ row, processId, invoices }: { row: ProcessItemRow; processId: string; invoices: { id: string; invoiceNumber: string }[] }) {
  const benefit = benefitOf(row);
  const total = num(row.quantity);
  const reserved = row.reservations.reduce((s, r) => s + Number(r.quantity), 0);
  const cpOption = CP_STATUS_OPTIONS.find((o) => o.value === row.cpStatus);

  return (
    <div className="grid grid-cols-1 gap-5 border-t border-outline-variant/60 bg-surface-container-low/60 p-4 lg:grid-cols-3">
      {/* 1. editar */}
      <div>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">Editar item</h4>
        <form action={updateProcessItem.bind(null, row.id, processId)} className="grid grid-cols-2 gap-1.5">
          {!row.productId && (
            <>
              <input className={`${INPUT} col-span-2`} name="description" defaultValue={row.description} aria-label="Descrição" required />
              <input className={`${INPUT} col-span-2 font-mono-data`} name="sku" defaultValue={row.sku ?? ""} placeholder="SKU" aria-label="SKU" />
            </>
          )}
          <input className={INPUT} type="number" step="0.01" name="quantity" defaultValue={row.quantity ?? ""} placeholder="Quantidade" aria-label="Quantidade" />
          <input className={INPUT} name="reservedTo" defaultValue={row.reservedTo ?? ""} placeholder="Reserva (planilha)" aria-label="Reserva" />
          <select className={`${INPUT} col-span-2`} name="invoiceId" defaultValue={row.invoiceId ?? ""} aria-label="Invoice">
            <option value="">Sem invoice</option>
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                Invoice {inv.invoiceNumber}
              </option>
            ))}
          </select>
          <select
            className={INPUT}
            name="exchangeCoverage"
            defaultValue={row.exchangeCoverage === null ? "" : row.exchangeCoverage ? "sim" : "nao"}
            aria-label="Cobertura cambial"
          >
            <option value="">Cobertura cambial?</option>
            <option value="sim">Cobertura cambial: Sim</option>
            <option value="nao">Cobertura cambial: Não</option>
          </select>
          <select
            className={INPUT}
            name="lpcoPublicConsultation"
            defaultValue={row.lpcoPublicConsultation === null ? "" : row.lpcoPublicConsultation ? "sim" : "nao"}
            aria-label="LPCO em consulta pública"
          >
            <option value="">LPCO consulta pública?</option>
            <option value="sim">LPCO consulta pública: Sim</option>
            <option value="nao">LPCO consulta pública: Não</option>
          </select>
          <input className={`${INPUT} col-span-2 font-mono-data`} name="lpcoNumber" defaultValue={row.lpcoNumber ?? ""} placeholder="LPCO do item (nº)" aria-label="LPCO do item" />
          <SubmitButton className={`${SAVE_BTN} col-span-2`}>
            Salvar item
          </SubmitButton>
        </form>
        <form action={updateProcessItemValue.bind(null, row.id, processId)} className="mt-3 flex gap-1.5">
          <input
            className={`${INPUT} w-32`}
            type="number"
            step="0.01"
            name="unitValueOverride"
            defaultValue={row.unitValue ?? ""}
            placeholder="Valor unitário"
            aria-label="Valor unitário"
          />
          <SubmitButton className={SAVE_BTN}>
            Salvar valor
          </SubmitButton>
        </form>
      </div>

      {/* 2. benefício */}
      <div>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">Consulta pública e benefício</h4>
        <div className="space-y-1.5 text-xs">
          <p>
            <span className={`rounded-full px-2 py-0.5 font-bold ${benefit.className}`}>{benefit.label}</span>
          </p>
          {row.productId ? (
            <>
              <p className="text-on-surface-variant">
                Consulta pública: <strong className="text-primary">{cpOption?.label ?? "Ainda não verificado"}</strong>
              </p>
              <p className="text-on-surface-variant">
                Lista do governo:{" "}
                <strong className="text-primary">
                  {row.cpListResult ? CP_LIST_RESULT_LABEL[row.cpListResult as CpListResult] ?? row.cpListResult : "não conferida"}
                </strong>
                {row.cpListRef ? ` · CP ${row.cpListRef}` : ""}
              </p>
              {row.ncm && <p className="text-on-surface-variant">NCM: <span className="font-mono-data text-primary">{row.ncm}</span></p>}
            </>
          ) : (
            <p className="text-on-surface-variant">Item avulso: não tem cadastro de produto para consultar.</p>
          )}
        </div>
        <h5 className="mb-1 mt-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">LPCO por estado</h5>
        <ul className="space-y-1 text-xs">
          {BRANCHES.map((b) => {
            const l = row.lpcos
              .filter((x) => x.branch === b.code)
              .sort((x, y) => (y.requestedAt ?? y.approvedAt ?? "").localeCompare(x.requestedAt ?? x.approvedAt ?? ""))[0];
            const tone = l ? lpcoTone(l) : "none";
            const until = l?.status === "DEFERIDO" ? lpcoValidUntil(l.approvedAt, l.validUntil) : null;
            const cd = l?.status === "DEFERIDO" ? lpcoCountdown(l.approvedAt, undefined, l.validUntil) : null;
            return (
              <li key={b.code} className="flex flex-wrap items-center gap-2">
                <span className={`w-9 rounded px-1.5 py-0.5 text-center font-bold ${LPCO_TONE_CLASS[tone]}`}>{b.code}</span>
                <span className="text-on-surface-variant">{l ? productLpcoStatusLabel(l.status) : "Sem solicitação"}</span>
                {cd && until && (
                  <span className={cd.expired ? "text-warning" : "text-on-surface-variant"}>
                    · {cd.expired ? `venceu há ${Math.abs(cd.daysLeft)} dias` : `${cd.daysLeft} dias restantes`} (até {formatDate(until)})
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {row.productId && (
          <Link href={`/consulta/${row.productId}`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-secondary hover:underline">
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            Ver ficha do produto
          </Link>
        )}
      </div>

      {/* 3. reservas */}
      <div>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">Reservas</h4>
        {total > 0 ? (
          <>
            <p className="mb-1.5 text-xs text-on-surface-variant">
              Pedido: {fmtQty(total)} · Reservado: {fmtQty(reserved)} · Disponível: {fmtQty(total - reserved)}
            </p>
            {row.reservations.length > 0 && (
              <ul className="mb-2 space-y-0.5 text-xs text-on-surface-variant">
                {row.reservations.map((r) => (
                  <li key={r.id}>
                    {r.personName} — {r.quantity}
                    {r.observation ? ` (${r.observation})` : ""}
                  </li>
                ))}
              </ul>
            )}
            <form action={addItemReservation.bind(null, processId, row.id)} className="flex flex-wrap gap-1.5">
              <input className={`${INPUT} w-28`} placeholder="Nome" name="personName" required />
              <input className={`${INPUT} w-16`} placeholder="Qtd" type="number" step="0.01" name="quantity" required />
              <input className={`${INPUT} min-w-24 flex-1`} placeholder="Obs. (opcional)" name="observation" />
              <SubmitButton className="rounded-lg border border-outline px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-container-high">
                Reservar
              </SubmitButton>
            </form>
          </>
        ) : (
          <p className="text-xs text-on-surface-variant">Informe a quantidade do item para poder reservar.</p>
        )}
        <div className="mt-4 border-t border-outline-variant/60 pt-3">
          <DeleteExternalImportItemButton action={removeProcessItem.bind(null, row.id, processId)} description={row.description} compact />
        </div>
      </div>
    </div>
  );
}

// Itens do processo em lista: foto, SKU, quantidade, valor, invoice, se a
// consulta pública dá benefício, LPCO por estado (SP/SC/CE) e estoque. Clicar
// na linha abre os detalhes e a edição. No celular vira uma lista de cartões.
export default function ProcessItemsTable({
  processId,
  rows,
  invoices,
  currency,
  destinationBranch,
  addForm,
}: {
  processId: string;
  rows: ProcessItemRow[];
  invoices: { id: string; invoiceNumber: string }[];
  currency: string | null;
  destinationBranch: string | null;
  addForm: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(rows.length === 0);

  const counts = useMemo(() => {
    const c = { com: 0, sem: 0, verificar: 0 };
    for (const r of rows) c[GROUP_OF[benefitOf(r).kind]]++;
    return c;
  }, [rows]);

  const totalQty = rows.reduce((s, r) => s + num(r.quantity), 0);
  const totalValue = rows.reduce((s, r) => s + num(r.quantity) * num(r.unitValue), 0);

  const q = query.trim().toLowerCase();
  const visible = rows.filter((r) => {
    if (filter !== "todos" && GROUP_OF[benefitOf(r).kind] !== filter) return false;
    if (!q) return true;
    return [r.description, r.sku, r.manufacturerSku, r.poLabel, r.invoiceNumber].some((v) => v?.toLowerCase().includes(q));
  });

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: "todos", label: "Todos", count: rows.length },
    { key: "com", label: "Com benefício", count: counts.com },
    { key: "sem", label: "Sem benefício", count: counts.sem },
    { key: "verificar", label: "A verificar", count: counts.verificar },
  ];

  const GRID = "lg:grid lg:grid-cols-[minmax(260px,2.4fr)_80px_120px_minmax(110px,0.8fr)_minmax(170px,1.3fr)_minmax(140px,1fr)_130px_36px] lg:items-center lg:gap-3";

  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-gutter shadow-sm">
      <div className="mb-stack-md flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-headline-sm text-headline-sm text-primary">Itens do Processo</h3>
          <p className="text-xs text-on-surface-variant">
            {rows.length} {rows.length === 1 ? "item" : "itens"} · {fmtQty(totalQty)} un.
            {totalValue > 0 ? ` · ${fmt(totalValue)}${currency ? ` ${currency}` : ""}` : ""}
            {destinationBranch ? ` · destino ${destinationBranch} (LPCO em destaque)` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-2 font-label-md text-label-md text-white hover:opacity-90"
        >
          <span className="material-symbols-outlined text-[18px]">{showAdd ? "close" : "add"}</span>
          {showAdd ? "Fechar" : "Adicionar item"}
        </button>
      </div>

      {showAdd && <div className="mb-stack-md rounded-lg border border-outline-variant bg-surface-container-low/50 p-3">{addForm}</div>}

      {rows.length > 0 && (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                  filter === f.key ? "bg-secondary text-white" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                }`}
              >
                {f.label} <span className="opacity-80">{f.count}</span>
              </button>
            ))}
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, SKU, invoice ou pedido…"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-xs focus:border-secondary focus:outline-none sm:w-72"
          />
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-body-sm font-body-sm text-on-surface-variant">Nenhum item registrado.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-outline-variant">
          <div className={`hidden bg-surface-container px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant ${GRID}`}>
            <span>Produto</span>
            <span className="text-right">Qtd</span>
            <span className="text-right">Valor</span>
            <span>Invoice</span>
            <span>Consulta pública</span>
            <span>LPCO por estado</span>
            <span>Estoque</span>
            <span />
          </div>

          {visible.length === 0 && <p className="p-4 text-body-sm text-on-surface-variant">Nenhum item com esse filtro.</p>}

          {visible.map((r) => {
            const benefit = benefitOf(r);
            const total = num(r.quantity);
            const reserved = r.reservations.reduce((s, x) => s + Number(x.quantity), 0);
            const available = total - reserved;
            const stock = total > 0 ? stockStatus(available, total) : null;
            const open = openId === r.id;
            const lineTotal = num(r.quantity) * num(r.unitValue);
            return (
              <div key={r.id} className="border-t border-outline-variant/60 first:border-t-0 lg:border-t">
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : r.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenId(open ? null : r.id);
                    }
                  }}
                  className={`cursor-pointer px-3 py-3 text-body-sm font-body-sm transition-colors hover:bg-surface-container-low ${open ? "bg-surface-container-low" : ""} ${GRID} grid grid-cols-2 gap-x-3 gap-y-2`}
                >
                  {/* produto */}
                  <div className="col-span-2 flex items-center gap-3 lg:col-span-1">
                    <ItemPhoto url={r.photoUrl} alt={r.description} className="h-14 w-14 shrink-0 rounded-lg border border-outline-variant [&_.material-symbols-outlined]:!text-[28px]" />
                    <div className="min-w-0">
                      <p className="font-medium leading-snug text-primary">{r.description}</p>
                      <p className="font-mono-data text-xs text-outline">
                        {r.sku ?? "sem SKU"}
                        {r.manufacturerSku && r.manufacturerSku !== r.sku ? ` · ${r.manufacturerSku}` : ""}
                      </p>
                      {r.poLabel && (
                        <span className="mt-0.5 inline-flex rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
                          {r.poLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="lg:text-right">
                    <Label>Qtd</Label>
                    <span className="font-bold text-primary">{total ? fmtQty(total) : "—"}</span>
                  </div>

                  <div className="lg:text-right">
                    <Label>Valor</Label>
                    {r.unitValue ? (
                      <>
                        <span className="block font-mono-data text-xs">{fmt(num(r.unitValue))}</span>
                        {lineTotal > 0 && <span className="block text-[11px] text-on-surface-variant">total {fmt(lineTotal)}</span>}
                      </>
                    ) : (
                      <span className="text-xs text-on-surface-variant">sem valor</span>
                    )}
                  </div>

                  <div>
                    <Label>Invoice</Label>
                    <span className="block font-mono-data text-xs">{r.invoiceNumber ?? "—"}</span>
                    {r.exchangeCoverage !== null && (
                      <span className="block text-[11px] text-on-surface-variant">Cobertura cambial: {r.exchangeCoverage ? "sim" : "não"}</span>
                    )}
                  </div>

                  <div>
                    <Label>Consulta pública</Label>
                    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${benefit.className}`}>{benefit.label}</span>
                    {benefit.detail && <span className="block text-[11px] text-on-surface-variant">{benefit.detail}</span>}
                    {r.lpcoPublicConsultation !== null && (
                      <span className="block text-[11px] text-on-surface-variant">LPCO em consulta pública: {r.lpcoPublicConsultation ? "sim" : "não"}</span>
                    )}
                  </div>

                  <div>
                    <Label>LPCO por estado</Label>
                    {r.productId ? (
                      <LpcoUfChips lpcos={r.lpcos} highlight={destinationBranch} />
                    ) : (
                      <span className="text-xs text-on-surface-variant">—</span>
                    )}
                    {r.lpcoNumber && <span className="mt-0.5 block font-mono-data text-[11px] text-on-surface-variant">LPCO {r.lpcoNumber}</span>}
                  </div>

                  <div>
                    <Label>Estoque</Label>
                    {stock ? (
                      <>
                        <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] ${stock.className}`}>{stock.label}</span>
                        <span className="block text-[11px] text-on-surface-variant">
                          disp. {fmtQty(available)} de {fmtQty(total)}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-on-surface-variant">—</span>
                    )}
                  </div>

                  <span className="material-symbols-outlined col-span-2 justify-self-end text-on-surface-variant transition-transform lg:col-span-1" style={{ transform: open ? "rotate(180deg)" : undefined }}>
                    expand_more
                  </span>
                </div>
                {open && <ItemPanel row={r} processId={processId} invoices={invoices} />}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
