import Link from "next/link";
import DeletePurchaseOrderButton from "@/components/DeletePurchaseOrderButton";
import { db } from "@/db/client";
import { purchaseOrders, suppliers, purchaseOrderItems } from "@/db/schema";
import { eq, ilike, sql } from "drizzle-orm";
import {
  PURCHASE_ORDER_STATUS_LABEL,
  PURCHASE_ORDER_STATUS_BADGE_CLASS,
  formatDate,
  type PurchaseOrderStatus,
} from "@/lib/status";
import { deletePurchaseOrder } from "@/app/pedidos-compra/actions";

export const dynamic = "force-dynamic";

export default async function PedidosCompraPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  const rows = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      status: purchaseOrders.status,
      currency: purchaseOrders.currency,
      expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
      createdAt: purchaseOrders.createdAt,
      supplierName: suppliers.name,
      processId: purchaseOrders.processId,
      itemCount: sql<number>`count(${purchaseOrderItems.id})`.mapWith(Number),
      total: sql<number>`coalesce(sum(${purchaseOrderItems.quantity} * ${purchaseOrderItems.unitPrice}), 0)`.mapWith(Number),
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .leftJoin(purchaseOrderItems, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
    .where(q ? ilike(purchaseOrders.poNumber, `%${q}%`) : undefined)
    .groupBy(purchaseOrders.id, suppliers.name)
    .orderBy(purchaseOrders.createdAt);

  return (
    <div className="p-6 md:p-10 max-w-[1200px] mx-auto w-full space-y-stack-lg">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-display-lg text-display-lg text-primary">Pedidos de Compra</h2>
          <p className="text-on-surface-variant font-body-md text-body-md mt-1">
            Monte, envie e confirme o pedido com o fornecedor antes de virar um processo de
            importação.
          </p>
        </div>
        <Link
          href="/pedidos-compra/novo"
          className="px-6 py-2.5 rounded-lg bg-secondary text-white font-label-md text-label-md hover:bg-secondary/90 transition-all shadow-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Novo Pedido
        </Link>
      </div>

      <form action="/pedidos-compra" className="relative max-w-md">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
          search
        </span>
        <input
          className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:border-secondary transition-colors font-body-md text-body-md"
          placeholder="Buscar por número do pedido..."
          type="text"
          name="q"
          defaultValue={q}
        />
      </form>

      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">PEDIDO</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">FORNECEDOR</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">STATUS</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">ITENS</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">TOTAL</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">ENTREGA PREVISTA</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">PROCESSO</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant font-body-sm text-body-sm">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-6 text-on-surface-variant text-center">
                    {q ? "Nenhum pedido encontrado para essa busca." : "Nenhum pedido de compra criado ainda."}
                  </td>
                </tr>
              )}
              {rows.map((po) => (
                <tr key={po.id} className="hover:bg-surface-container-high transition-colors">
                  <td className="px-6 py-3 font-mono-data">
                    <Link href={`/pedidos-compra/${po.id}`} className="text-secondary hover:underline">
                      {po.poNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-3">{po.supplierName}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`px-2 py-1 rounded-full font-label-md text-label-md ${PURCHASE_ORDER_STATUS_BADGE_CLASS[po.status as PurchaseOrderStatus]}`}
                    >
                      {PURCHASE_ORDER_STATUS_LABEL[po.status as PurchaseOrderStatus]}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-mono-data">{po.itemCount}</td>
                  <td className="px-6 py-3 font-mono-data">
                    {po.total > 0 ? `${po.total.toFixed(2)} ${po.currency ?? ""}` : "—"}
                  </td>
                  <td className="px-6 py-3">{formatDate(po.expectedDeliveryDate)}</td>
                  <td className="px-6 py-3">
                    {po.processId ? (
                      <Link href={`/processos/${po.processId}`} className="text-secondary hover:underline">
                        Ver processo
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-col gap-1.5 items-start">
                      {po.status === "RASCUNHO" && (
                        <Link
                          href={`/pedidos-compra/${po.id}`}
                          className="flex items-center gap-1 text-secondary hover:underline w-fit"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                          Editar
                        </Link>
                      )}
                      {po.status === "CONFIRMADO" && !po.processId && (
                        <Link
                          href={`/pedidos-compra/${po.id}`}
                          className="flex items-center gap-1 text-secondary hover:underline w-fit"
                        >
                          <span className="material-symbols-outlined text-[16px]">send</span>
                          Enviar para Processo
                        </Link>
                      )}
                      {po.status !== "CONFIRMADO" && !po.processId && (
                        <DeletePurchaseOrderButton
                          action={deletePurchaseOrder.bind(null, po.id)}
                          poNumber={po.poNumber}
                          compact
                        />
                      )}
                      {po.status === "CONFIRMADO" && po.processId && "—"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
