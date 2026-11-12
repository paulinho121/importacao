import Link from "next/link";
import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { purchaseOrders, purchaseOrderItems, purchaseOrderDocuments, suppliers } from "@/db/schema";
import { addPurchaseOrderToProcess, removePurchaseOrderFromProcess } from "@/app/processos/actions";
import ConfirmActionButton from "@/components/ConfirmActionButton";
import SupplierLogo from "@/components/SupplierLogo";
import DocumentViewer from "@/components/DocumentViewer";
import { driveDownloadUrl } from "@/lib/drive-links";
import DriveLinkActions from "@/components/DriveLinkActions";
import { PURCHASE_ORDER_STATUS_BADGE_CLASS, PURCHASE_ORDER_STATUS_LABEL, type PurchaseOrderStatus } from "@/lib/status";

import SubmitButton from "@/components/SubmitButton";
function money(value: number, currency: string | null) {
  if (currency && currency !== "OTHER") {
    try {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
    } catch {
      // moeda com código inválido pro Intl — cai no número simples abaixo
    }
  }
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}${currency ? ` ${currency}` : ""}`;
}

const poTotals = {
  itemCount: sql<number>`count(${purchaseOrderItems.id})`.mapWith(Number),
  quantity: sql<number>`coalesce(sum(${purchaseOrderItems.quantity}), 0)`.mapWith(Number),
  total: sql<number>`coalesce(sum(${purchaseOrderItems.quantity} * ${purchaseOrderItems.unitPrice}), 0)`.mapWith(Number),
};

// O processo é a importação (ex.: um contêiner) e reúne vários pedidos de
// compra, de fornecedores diferentes. Aqui ficam os pedidos do processo e o
// formulário para colocar outro pedido confirmado dentro dele.
export default async function ProcessPurchaseOrders({ processId, closed }: { processId: string; closed: boolean }) {
  const [linked, available] = await Promise.all([
    db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        status: purchaseOrders.status,
        currency: purchaseOrders.currency,
        supplierName: suppliers.name,
        supplierLogoUrl: suppliers.logoUrl,
        packingListUrl: purchaseOrders.packingListUrl,
        invoiceUrl: purchaseOrders.invoiceUrl,
        ...poTotals,
      })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .leftJoin(purchaseOrderItems, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
      .where(eq(purchaseOrders.processId, processId))
      .groupBy(purchaseOrders.id, suppliers.name, suppliers.logoUrl)
      .orderBy(purchaseOrders.poNumber),
    closed
      ? Promise.resolve([])
      : db
          .select({
            id: purchaseOrders.id,
            poNumber: purchaseOrders.poNumber,
            status: purchaseOrders.status,
            currency: purchaseOrders.currency,
            supplierName: suppliers.name,
            ...poTotals,
          })
          .from(purchaseOrders)
          .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
          .leftJoin(purchaseOrderItems, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
          .where(and(ne(purchaseOrders.status, "CANCELADO"), isNull(purchaseOrders.processId)))
          .groupBy(purchaseOrders.id, suppliers.name)
          .orderBy(suppliers.name, purchaseOrders.poNumber),

  ]);

  // Packing lists anexadas a cada pedido do processo (vieram junto com o pedido).
  const packingDocs =
    linked.length === 0
      ? []
      : await db
          .select()
          .from(purchaseOrderDocuments)
          .where(inArray(purchaseOrderDocuments.purchaseOrderId, linked.map((l) => l.id)))
          .orderBy(asc(purchaseOrderDocuments.uploadedAt));
  const packingByPo = new Map<string, { id: string; fileName: string }[]>();
  packingDocs.forEach((d) => {
    const list = packingByPo.get(d.purchaseOrderId) ?? [];
    list.push({ id: d.id, fileName: d.fileName });
    packingByPo.set(d.purchaseOrderId, list);
  });

  const currencies = [...new Set(linked.map((l) => l.currency).filter(Boolean))];
  const totalsByCurrency = new Map<string, number>();
  for (const l of linked) totalsByCurrency.set(l.currency ?? "—", (totalsByCurrency.get(l.currency ?? "—") ?? 0) + l.total);
  const boundAdd = addPurchaseOrderToProcess.bind(null, processId);

  return (
    <section className="bg-surface-container-lowest border border-outline-variant p-gutter rounded-xl shadow-sm">
      <div className="mb-stack-md flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-headline-sm text-headline-sm text-primary">Pedidos de compra do processo</h3>
          <p className="text-body-sm font-body-sm text-on-surface-variant">
            Este processo é a importação (ex.: o contêiner). Reúna aqui os pedidos de cada fornecedor que vão juntos.
          </p>
        </div>
        <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-bold text-on-surface-variant">
          {linked.length} {linked.length === 1 ? "pedido" : "pedidos"} · {new Set(linked.map((l) => l.supplierName)).size}{" "}
          {new Set(linked.map((l) => l.supplierName)).size === 1 ? "fornecedor" : "fornecedores"}
        </span>
      </div>

      {linked.length === 0 ? (
        <p className="text-body-sm font-body-sm text-on-surface-variant">Nenhum pedido neste processo ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-body-sm font-body-sm">
            <thead>
              <tr className="border-b border-outline-variant text-xs text-on-surface-variant">
                <th className="py-2 pr-3 font-label-md">PEDIDO</th>
                <th className="py-2 pr-3 font-label-md">FORNECEDOR</th>
                <th className="py-2 pr-3 font-label-md">STATUS</th>
                <th className="py-2 pr-3 font-label-md text-right">ITENS</th>
                <th className="py-2 pr-3 font-label-md text-right">QTD</th>
                <th className="py-2 pr-3 font-label-md text-right">VALOR</th>
                <th className="py-2 pr-3 font-label-md">PACKING LIST</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {linked.map((l) => (
                <tr key={l.id} className="border-b border-outline-variant/50">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <Link href={`/pedidos-compra/${l.id}`} className="font-mono-data text-secondary hover:underline">
                      {l.poNumber}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2">
                      <SupplierLogo logoUrl={l.supplierLogoUrl} name={l.supplierName} size={24} />
                      {l.supplierName}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${PURCHASE_ORDER_STATUS_BADGE_CLASS[l.status as PurchaseOrderStatus]}`}
                    >
                      {PURCHASE_ORDER_STATUS_LABEL[l.status as PurchaseOrderStatus]}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right font-mono-data">{l.itemCount}</td>
                  <td className="py-2 pr-3 text-right font-mono-data">{l.quantity}</td>
                  <td className="py-2 pr-3 text-right font-mono-data whitespace-nowrap">{money(l.total, l.currency)}</td>
                  <td className="py-2 pr-3">
                    {(packingByPo.get(l.id) ?? []).length === 0 && !l.packingListUrl && !l.invoiceUrl ? (
                      <span className="text-xs text-on-surface-variant">—</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {[
                          { label: "Packing list", url: l.packingListUrl },
                          { label: "Invoice", url: l.invoiceUrl },
                        ].map((x) =>
                          driveDownloadUrl(x.url) ? (
                            <li key={x.label} className="flex flex-wrap items-center gap-1">
                              <span className="text-xs font-bold text-on-surface-variant">{x.label}</span>
                              <DriveLinkActions url={x.url} title={x.label} compact />
                            </li>
                          ) : null,
                        )}
                        {(packingByPo.get(l.id) ?? []).map((d) => (
                          <li key={d.id} className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] text-on-surface-variant">inventory</span>
                            <DocumentViewer
                              src={`/api/pedidos-compra/documentos/${d.id}`}
                              fileName={d.fileName}
                              className="max-w-[220px] truncate text-xs font-bold text-secondary"
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {!closed && (
                      <ConfirmActionButton
                        action={removePurchaseOrderFromProcess.bind(null, processId, l.id)}
                        label="Remover"
                        message={`Remover o pedido ${l.poNumber} deste processo? Os itens que vieram dele também saem do processo.`}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="pt-2 pr-3 text-right text-xs font-bold text-on-surface-variant">
                  Total dos pedidos
                </td>
                <td className="pt-2 pr-3 text-right font-mono-data font-bold whitespace-nowrap">
                  {[...totalsByCurrency.entries()].map(([cur, v]) => (
                    <div key={cur}>{money(v, cur === "—" ? null : cur)}</div>
                  ))}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {currencies.length > 1 && (
        <p className="mt-3 rounded-lg bg-warning/15 px-3 py-2 text-xs text-warning">
          Os pedidos deste processo estão em moedas diferentes ({currencies.join(", ")}). O custo pousado do processo
          usa uma moeda só — confira os valores antes de calcular.
        </p>
      )}

      {!closed && (
        <form action={boundAdd} className="mt-4 flex flex-col gap-2 border-t border-outline-variant pt-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block font-label-md text-label-md text-on-surface-variant">Adicionar pedido de compra</label>
            <select
              name="purchaseOrderId"
              required
              defaultValue=""
              disabled={available.length === 0}
              className="w-full appearance-none rounded-lg border border-outline-variant bg-surface-container-low p-2.5 text-body-sm font-body-sm focus:border-secondary focus:outline-none"
            >
              <option value="">
                {available.length === 0 ? "Nenhum pedido disponível" : "Escolha um pedido…"}
              </option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.supplierName} — {p.poNumber} · {PURCHASE_ORDER_STATUS_LABEL[p.status as PurchaseOrderStatus]} ({p.itemCount} {p.itemCount === 1 ? "item" : "itens"} · {money(p.total, p.currency)})
                </option>
              ))}
            </select>
          </div>
          <SubmitButton
            disabled={available.length === 0}
            className="rounded-lg bg-secondary px-4 py-2.5 font-label-md text-label-md text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Adicionar ao processo
          </SubmitButton>
        </form>
      )}
      {!closed && available.length === 0 && (
        <div className="mt-3 rounded-lg border border-dashed border-outline-variant p-4 text-body-sm font-body-sm">
          <p className="font-medium text-primary">Como colocar pedidos neste processo</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-on-surface-variant">
            <li>Crie o pedido de compra de cada fornecedor (Aputure, Swit, DZO…) em Pedidos de Compra.</li>
            <li>Adicione os itens ao pedido.</li>
            <li>Volte aqui: os pedidos que ainda não estão em nenhum processo aparecem na lista acima.</li>
          </ol>
          <Link
            href="/pedidos-compra/novo"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 font-label-md text-label-md text-white hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Criar pedido de compra
          </Link>
          <Link href="/pedidos-compra" className="ml-3 text-secondary hover:underline">
            Ver pedidos de compra
          </Link>
        </div>
      )}
    </section>
  );
}
