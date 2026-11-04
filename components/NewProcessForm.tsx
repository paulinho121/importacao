"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { createProcess } from "@/app/processos/actions";
import SupplierLogo from "@/components/SupplierLogo";
import {
  PURCHASE_ORDER_STATUS_BADGE_CLASS,
  PURCHASE_ORDER_STATUS_LABEL,
  type PurchaseOrderStatus,
} from "@/lib/status";

type SupplierLite = { id: string; name: string; logoUrl: string | null };
export type ProcessOption = { id: string; processNumber: string; suppliers: SupplierLite[] };
export type OrderOption = {
  id: string;
  poNumber: string;
  status: string;
  currency: string | null;
  supplierId: string;
  supplierName: string;
  supplierLogoUrl: string | null;
  itemCount: number;
  total: number;
};

const inputClass =
  "w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all";
const labelClass = "block font-label-md text-label-md text-on-surface-variant mb-2";

function money(value: number, currency: string | null) {
  if (currency && currency !== "OTHER") {
    try {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
    } catch {
      // código de moeda inválido pro Intl — cai no número simples abaixo
    }
  }
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}${currency ? ` ${currency}` : ""}`;
}

// Cabeçalho da tela "Novo Processo": o campo Número do Processo é uma lista
// com os processos existentes + "Criar novo processo"; os pedidos de compra já
// criados entram no processo por aqui, e os fornecedores do processo aparecem
// à medida que os pedidos são adicionados. `children` são os demais campos
// (referência, modalidade, datas…), que só valem ao criar um processo novo.
export default function NewProcessForm({
  suggestedNumber,
  suppliers,
  processes,
  orders,
  children,
}: {
  suggestedNumber: string;
  suppliers: { id: string; name: string }[];
  processes: ProcessOption[];
  orders: OrderOption[];
  children: ReactNode;
}) {
  const [existingId, setExistingId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pick, setPick] = useState("");

  const existing = processes.find((p) => p.id === existingId) ?? null;
  const selected = selectedIds.map((id) => orders.find((o) => o.id === id)).filter((o): o is OrderOption => Boolean(o));
  const pickable = orders.filter((o) => !selectedIds.includes(o.id));

  // Fornecedores do processo: os que ele já tem + os dos pedidos adicionados.
  const supplierList: SupplierLite[] = [];
  for (const s of existing?.suppliers ?? []) if (!supplierList.some((x) => x.id === s.id)) supplierList.push(s);
  for (const o of selected) {
    if (!supplierList.some((x) => x.id === o.supplierId)) {
      supplierList.push({ id: o.supplierId, name: o.supplierName, logoUrl: o.supplierLogoUrl });
    }
  }

  function addPick() {
    if (!pick) return;
    setSelectedIds((ids) => (ids.includes(pick) ? ids : [...ids, pick]));
    setPick("");
  }

  const needsManualSupplier = !existing && selected.length === 0;

  return (
    <form action={createProcess} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className={labelClass}>Número do Processo</label>
          <select
            className={`${inputClass} appearance-none`}
            name="existingProcessId"
            value={existingId}
            onChange={(e) => setExistingId(e.target.value)}
          >
            <option value="">➕ Criar novo processo</option>
            {processes.length > 0 && (
              <optgroup label="Processos existentes (em andamento)">
                {processes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.processNumber}
                    {p.suppliers.length > 0 ? ` — ${p.suppliers.map((s) => s.name).join(", ")}` : ""}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {!existing && (
            <input
              className={`${inputClass} mt-2 font-mono-data`}
              type="text"
              name="processNumber"
              defaultValue={suggestedNumber}
              placeholder="Número do novo processo"
              required
            />
          )}
        </div>

        <div>
          <label className={labelClass}>{supplierList.length > 1 ? "Fornecedores" : "Fornecedor"}</label>
          {needsManualSupplier ? (
            <>
              <select className={`${inputClass} appearance-none`} name="supplierId" required defaultValue="">
                <option value="" disabled>
                  Selecione o fornecedor (ou adicione um pedido)
                </option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {suppliers.length === 0 && (
                <p className="text-xs text-error mt-1">Nenhum fornecedor cadastrado — cadastre um em /fornecedores/novo primeiro.</p>
              )}
            </>
          ) : (
            <div className="flex min-h-[48px] flex-wrap items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low p-2">
              {supplierList.length === 0 ? (
                <span className="px-1 text-body-sm font-body-sm text-on-surface-variant">Sem fornecedor ainda</span>
              ) : (
                supplierList.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-2 rounded-md bg-surface-container-lowest px-1.5 py-1">
                    <SupplierLogo logoUrl={s.logoUrl} name={s.name} size={22} />
                    <span className="text-sm font-medium uppercase tracking-wide">{s.name}</span>
                  </span>
                ))
              )}
            </div>
          )}
          {!existing && selected.length > 0 && (
            <p className="mt-1 text-xs text-on-surface-variant">
              Carregado dos pedidos escolhidos abaixo
              {supplierList.length > 1 ? ` — o principal é ${supplierList[0].name}.` : "."}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <label className="font-label-md text-label-md text-on-surface-variant">Pedidos de compra do processo</label>
            <span className="text-xs text-on-surface-variant">
              {selected.length} {selected.length === 1 ? "pedido" : "pedidos"} · {supplierList.length}{" "}
              {supplierList.length === 1 ? "fornecedor" : "fornecedores"}
            </span>
          </div>

          {selected.length > 0 && (
            <ul className="mb-3 divide-y divide-outline-variant/50 rounded-lg border border-outline-variant">
              {selected.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-2.5">
                  <input type="hidden" name="purchaseOrderId" value={o.id} />
                  <SupplierLogo logoUrl={o.supplierLogoUrl} name={o.supplierName} size={22} />
                  <span className="text-sm font-medium uppercase tracking-wide">{o.supplierName}</span>
                  <Link href={`/pedidos-compra/${o.id}`} target="_blank" className="font-mono-data text-secondary hover:underline">
                    {o.poNumber}
                  </Link>
                  <span
                    className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${PURCHASE_ORDER_STATUS_BADGE_CLASS[o.status as PurchaseOrderStatus]}`}
                  >
                    {PURCHASE_ORDER_STATUS_LABEL[o.status as PurchaseOrderStatus]}
                  </span>
                  <span className="ml-auto text-xs text-on-surface-variant">
                    {o.itemCount} {o.itemCount === 1 ? "item" : "itens"} · {money(o.total, o.currency)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedIds((ids) => ids.filter((id) => id !== o.id))}
                    className="text-xs text-error hover:underline"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              className={`${inputClass} flex-1 appearance-none`}
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              disabled={pickable.length === 0}
            >
              <option value="">
                {orders.length === 0
                  ? "Nenhum pedido disponível"
                  : pickable.length === 0
                    ? "Todos os pedidos disponíveis já foram adicionados"
                    : "Escolha um pedido de compra já criado…"}
              </option>
              {pickable.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.supplierName} — {o.poNumber} · {PURCHASE_ORDER_STATUS_LABEL[o.status as PurchaseOrderStatus]} ({o.itemCount}{" "}
                  {o.itemCount === 1 ? "item" : "itens"} · {money(o.total, o.currency)})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addPick}
              disabled={!pick}
              className="rounded-lg bg-secondary px-5 py-3 font-label-md text-label-md text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Adicionar pedido
            </button>
          </div>
          {orders.length === 0 && (
            <p className="mt-2 text-xs text-on-surface-variant">
              Nenhum pedido sem processo.{" "}
              <Link href="/pedidos-compra/novo" className="text-secondary hover:underline">
                Criar pedido de compra
              </Link>
            </p>
          )}
          {existing && (
            <p className="mt-2 text-xs text-on-surface-variant">
              Os pedidos escolhidos serão adicionados ao processo {existing.processNumber}. Para mudar os dados dele
              (datas, agente, invoices…), abra o processo depois.
            </p>
          )}
        </div>

        {/* demais campos: só valem ao criar um processo novo */}
        <div className={existing ? "hidden" : "contents"}>{children}</div>
      </div>

      <div className="flex justify-end gap-4 pt-2">
        <button
          type="submit"
          className="px-8 py-3 rounded-lg bg-secondary text-white font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all"
        >
          {existing ? "Adicionar ao processo" : "Criar Processo"}
        </button>
      </div>
    </form>
  );
}
