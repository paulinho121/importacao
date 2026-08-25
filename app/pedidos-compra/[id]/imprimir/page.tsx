import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { purchaseOrders, purchaseOrderItems, suppliers, products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatDate } from "@/lib/status";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function PedidoCompraImprimirPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [po] = await db
    .select({
      poNumber: purchaseOrders.poNumber,
      currency: purchaseOrders.currency,
      incoterm: purchaseOrders.incoterm,
      expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
      notes: purchaseOrders.notes,
      createdAt: purchaseOrders.createdAt,
      supplierName: suppliers.name,
      supplierContactName: suppliers.contactName,
      supplierEmail: suppliers.email,
      supplierPhone: suppliers.phone,
      supplierCountry: suppliers.country,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(eq(purchaseOrders.id, id));

  if (!po) notFound();

  const items = await db
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
    .where(eq(purchaseOrderItems.purchaseOrderId, id));
  const total = items.reduce((sum, item) => sum + Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0), 0);

  return (
    <div className="min-h-screen bg-white text-black p-10 max-w-[820px] mx-auto font-sans">
      <PrintButton />

      <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
        <div>
          <h1 className="text-2xl font-bold">PEDIDO DE COMPRA</h1>
          <p className="text-lg font-mono mt-1">Nº {po.poNumber}</p>
        </div>
        <div className="text-right text-sm">
          <p>Data: {formatDate(new Date(po.createdAt).toISOString().slice(0, 10))}</p>
          {po.expectedDeliveryDate && <p>Entrega prevista: {formatDate(po.expectedDeliveryDate)}</p>}
          {po.incoterm && <p>Incoterm: {po.incoterm}</p>}
        </div>
      </div>

      <div className="mb-6">
        <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Fornecedor</p>
        <p className="font-semibold">{po.supplierName}</p>
        {po.supplierContactName && <p className="text-sm">Contato: {po.supplierContactName}</p>}
        {po.supplierEmail && <p className="text-sm">{po.supplierEmail}</p>}
        {po.supplierPhone && <p className="text-sm">{po.supplierPhone}</p>}
        {po.supplierCountry && <p className="text-sm">{po.supplierCountry}</p>}
      </div>

      <table className="w-full text-left border-collapse text-sm mb-6">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="py-2 pr-3">Item</th>
            <th className="py-2 pr-3">SKU Fabricante</th>
            <th className="py-2 pr-3 text-right">Qtd</th>
            <th className="py-2 pr-3 text-right">Preço Unit.</th>
            <th className="py-2 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const subtotal = Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0);
            return (
              <tr key={item.id} className="border-b border-gray-300">
                <td className="py-2 pr-3">{item.description}</td>
                <td className="py-2 pr-3 font-mono">{item.manufacturerSku ?? item.sku ?? "—"}</td>
                <td className="py-2 pr-3 text-right">{item.quantity ?? "—"}</td>
                <td className="py-2 pr-3 text-right">{Number(item.unitPrice ?? 0).toFixed(2)}</td>
                <td className="py-2 text-right font-semibold">{subtotal.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black">
            <td colSpan={4} className="py-2 pr-3 text-right font-bold">
              Total ({po.currency ?? "—"})
            </td>
            <td className="py-2 text-right font-bold">{total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      {po.notes && (
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Observações</p>
          <p className="text-sm whitespace-pre-wrap">{po.notes}</p>
        </div>
      )}
    </div>
  );
}
