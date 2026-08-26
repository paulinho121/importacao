import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import AddPurchaseOrderItemForm from "@/components/AddPurchaseOrderItemForm";
import DeletePurchaseOrderButton from "@/components/DeletePurchaseOrderButton";
import { db } from "@/db/client";
import { purchaseOrders, purchaseOrderItems, suppliers, products, processes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  PURCHASE_ORDER_STATUS_LABEL,
  PURCHASE_ORDER_STATUS_BADGE_CLASS,
  formatDate,
  type PurchaseOrderStatus,
} from "@/lib/status";
import {
  addPurchaseOrderItem,
  removePurchaseOrderItem,
  updatePurchaseOrderStatus,
  updatePurchaseOrder,
  deletePurchaseOrder,
  convertToProcess,
} from "@/app/pedidos-compra/actions";
import { CURRENCIES } from "@/lib/currencies";
import { INCOTERMS } from "@/lib/incoterms";

export const dynamic = "force-dynamic";

async function suggestProcessNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const [{ count }] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(processes);
  return `PRC-${year}-${String(count + 1).padStart(3, "0")}`;
}

export default async function PedidoCompraDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [po] = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      status: purchaseOrders.status,
      currency: purchaseOrders.currency,
      incoterm: purchaseOrders.incoterm,
      expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
      notes: purchaseOrders.notes,
      sentAt: purchaseOrders.sentAt,
      confirmedAt: purchaseOrders.confirmedAt,
      processId: purchaseOrders.processId,
      supplierId: purchaseOrders.supplierId,
      supplierName: suppliers.name,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(eq(purchaseOrders.id, id));

  if (!po) notFound();

  const [items, [{ catalogCount }], suggestedProcessNumber] = await Promise.all([
    db
      .select({
        id: purchaseOrderItems.id,
        sku: purchaseOrderItems.sku,
        description: purchaseOrderItems.description,
        quantity: purchaseOrderItems.quantity,
        unitPrice: purchaseOrderItems.unitPrice,
        manufacturerSku: products.manufacturerSku,
      })
      .from(purchaseOrderItems)
      .leftJoin(products, eq(purchaseOrderItems.productId, products.id))
      .where(eq(purchaseOrderItems.purchaseOrderId, id)),
    db
      .select({ catalogCount: sql<number>`count(*)`.mapWith(Number) })
      .from(products)
      .where(eq(products.defaultSupplierId, po.supplierId)),
    po.status === "CONFIRMADO" && !po.processId ? suggestProcessNumber() : Promise.resolve(""),
  ]);

  const total = items.reduce((sum, item) => sum + Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0), 0);
  const isRascunho = po.status === "RASCUNHO";
  const boundAddItem = addPurchaseOrderItem.bind(null, id);
  const boundUpdateStatus = updatePurchaseOrderStatus.bind(null, id);
  const boundUpdatePo = updatePurchaseOrder.bind(null, id);
  const boundDelete = deletePurchaseOrder.bind(null, id);
  const boundConvert = convertToProcess.bind(null, id);

  return (
    <AppShell title="Detalhe do Pedido de Compra">
      <div className="p-6 md:p-10 max-w-[1200px] mx-auto w-full space-y-stack-lg">
        <div className="flex items-center justify-between">
          <Link
            href="/pedidos-compra"
            className="flex items-center gap-2 text-secondary font-semibold hover:underline group"
          >
            <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1">
              arrow_back
            </span>
            <span className="font-label-md text-label-md">VOLTAR PARA LISTA</span>
          </Link>
          <Link
            href={`/pedidos-compra/${id}/imprimir`}
            target="_blank"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-high transition-all font-label-md text-label-md"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            Ver Documento
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <h2 className="font-display-lg text-display-lg text-primary">Pedido #{po.poNumber}</h2>
          <span
            className={`px-3 py-1 rounded-full font-bold text-xs uppercase tracking-wider ${PURCHASE_ORDER_STATUS_BADGE_CLASS[po.status as PurchaseOrderStatus]}`}
          >
            {PURCHASE_ORDER_STATUS_LABEL[po.status as PurchaseOrderStatus]}
          </span>
          {isRascunho && (
            <details className="relative">
              <summary className="list-none cursor-pointer flex items-center gap-1 text-secondary hover:underline font-label-md text-label-md">
                <span className="material-symbols-outlined text-[16px]">edit</span>
                Editar Pedido
              </summary>
              <form
                action={boundUpdatePo}
                className="fixed inset-x-4 top-20 sm:absolute sm:inset-x-auto sm:top-auto sm:left-0 sm:mt-2 sm:w-[360px] z-10 bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-lg space-y-3"
              >
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1">
                    Número do Pedido
                  </label>
                  <input
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-body-sm font-body-sm font-mono-data focus:outline-none focus:border-secondary transition-all"
                    type="text"
                    name="poNumber"
                    defaultValue={po.poNumber}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Moeda</label>
                    <select
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all appearance-none"
                      name="currency"
                      defaultValue={po.currency ?? ""}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-1">
                      Entrega Prevista
                    </label>
                    <input
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
                      type="date"
                      name="expectedDeliveryDate"
                      defaultValue={po.expectedDeliveryDate ?? ""}
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Incoterm</label>
                  <select
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all appearance-none"
                    name="incoterm"
                    defaultValue={po.incoterm ?? ""}
                  >
                    <option value="">Selecione</option>
                    {INCOTERMS.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1">
                    Observações
                  </label>
                  <textarea
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
                    name="notes"
                    rows={3}
                    defaultValue={po.notes ?? ""}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-3 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all"
                >
                  Salvar
                </button>
              </form>
            </details>
          )}
        </div>
        <p className="text-on-surface-variant font-body-md text-body-md -mt-4">
          Fornecedor: {po.supplierName}
          {po.incoterm ? ` · Incoterm: ${po.incoterm}` : ""}
          {po.expectedDeliveryDate ? ` · Entrega prevista: ${formatDate(po.expectedDeliveryDate)}` : ""}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-stack-md">
          <div className="lg:col-span-8 space-y-stack-md">
            <section className="bg-white border border-outline-variant p-gutter rounded-xl shadow-sm">
              <h3 className="font-headline-sm text-headline-sm text-primary mb-stack-md">Itens do Pedido</h3>
              {items.length === 0 ? (
                <p className="text-on-surface-variant font-body-sm text-body-sm">Nenhum item adicionado ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-outline-variant text-on-surface-variant text-xs">
                        <th className="py-2 pr-3 font-label-md">ITEM</th>
                        <th className="py-2 pr-3 font-label-md text-right">QTD</th>
                        <th className="py-2 pr-3 font-label-md text-right">PREÇO UNIT.</th>
                        <th className="py-2 pr-3 font-label-md text-right">SUBTOTAL</th>
                        {isRascunho && <th className="py-2 font-label-md text-right">​</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/50 font-mono-data">
                      {items.map((item) => {
                        const subtotal = Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0);
                        const boundRemove = removePurchaseOrderItem.bind(null, item.id, id);
                        return (
                          <tr key={item.id}>
                            <td className="py-2 pr-3 font-body-sm">
                              {item.description}
                              {(item.manufacturerSku || item.sku) && (
                                <span className="block text-xs text-outline">
                                  SKU Fabricante: {item.manufacturerSku ?? item.sku}
                                </span>
                              )}
                            </td>
                            <td className="py-2 pr-3 text-right">{item.quantity ?? "—"}</td>
                            <td className="py-2 pr-3 text-right">{Number(item.unitPrice ?? 0).toFixed(2)}</td>
                            <td className="py-2 pr-3 text-right font-bold text-primary">{subtotal.toFixed(2)}</td>
                            {isRascunho && (
                              <td className="py-2 text-right">
                                <form action={boundRemove}>
                                  <button
                                    type="submit"
                                    className="text-error hover:underline text-xs"
                                    aria-label="Remover item"
                                  >
                                    Remover
                                  </button>
                                </form>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-right mt-3 font-bold text-primary">
                    Total: {total.toFixed(2)} {po.currency ?? ""}
                  </p>
                </div>
              )}

              {isRascunho && (
                <AddPurchaseOrderItemForm
                  action={boundAddItem}
                  supplierId={po.supplierId}
                  supplierName={po.supplierName}
                  hasProducts={catalogCount > 0}
                />
              )}
            </section>

            {po.notes && (
              <section className="bg-white border border-outline-variant p-gutter rounded-xl shadow-sm">
                <h3 className="font-headline-sm text-headline-sm text-primary mb-2">Observações</h3>
                <p className="text-body-sm font-body-sm text-on-surface-variant whitespace-pre-wrap">{po.notes}</p>
              </section>
            )}
          </div>

          <div className="lg:col-span-4">
            <section className="bg-white border border-outline-variant p-gutter rounded-xl shadow-sm space-y-4">
              <h3 className="font-headline-sm text-headline-sm text-primary">Status</h3>

              {po.status === "RASCUNHO" && (
                <form action={boundUpdateStatus}>
                  <input type="hidden" name="status" value="ENVIADO" />
                  <button
                    type="submit"
                    className="w-full px-4 py-2.5 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all"
                  >
                    Marcar como Enviado
                  </button>
                </form>
              )}

              {po.status === "ENVIADO" && (
                <div className="space-y-2">
                  <form action={boundUpdateStatus}>
                    <input type="hidden" name="status" value="CONFIRMADO" />
                    <button
                      type="submit"
                      className="w-full px-4 py-2.5 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all"
                    >
                      Marcar como Confirmado
                    </button>
                  </form>
                  <form action={boundUpdateStatus}>
                    <input type="hidden" name="status" value="CANCELADO" />
                    <button
                      type="submit"
                      className="w-full px-4 py-2.5 rounded-lg border border-outline-variant text-error font-label-md text-label-md hover:bg-error-container/20 transition-all"
                    >
                      Cancelar Pedido
                    </button>
                  </form>
                  {po.sentAt && (
                    <p className="text-xs text-on-surface-variant">
                      Enviado em {new Date(po.sentAt).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
              )}

              {po.status === "CONFIRMADO" && !po.processId && (
                <form action={boundConvert} className="space-y-3">
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                      Número do Processo
                    </label>
                    <input
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm font-mono-data focus:outline-none focus:border-secondary transition-all"
                      type="text"
                      name="processNumber"
                      defaultValue={suggestedProcessNumber}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full px-4 py-2.5 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all"
                  >
                    Criar Processo de Importação
                  </button>
                </form>
              )}

              {po.processId && (
                <Link
                  href={`/processos/${po.processId}`}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border border-outline-variant text-secondary hover:bg-secondary/10 transition-all font-label-md text-label-md"
                >
                  Ver Processo de Importação
                </Link>
              )}

              {po.status === "CANCELADO" && (
                <p className="text-on-surface-variant font-body-sm text-body-sm">Este pedido foi cancelado.</p>
              )}

              {po.status !== "CONFIRMADO" && !po.processId && (
                <div className="pt-2 border-t border-outline-variant">
                  <DeletePurchaseOrderButton action={boundDelete} poNumber={po.poNumber} />
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
