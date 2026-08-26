import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { purchaseOrders, purchaseOrderItems, suppliers, products, companyBranches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatDate } from "@/lib/status";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

// Cores fixas (nao usam os tokens de tema claro/escuro do app) porque este
// documento e impresso/exportado em PDF e precisa ficar sempre igual,
// independente do tema que o usuario tiver escolhido na tela.
const INK = "#0f172a";
const ACCENT = "#2563eb";
const MUTED = "#64748b";
const LINE = "#d8e0e9";

function currencyFormatter(currency: string | null) {
  if (currency && currency !== "OTHER") {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency });
    } catch {
      // moeda com codigo invalido pro Intl — cai no fallback abaixo
    }
  }
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
      supplierLogoUrl: suppliers.logoUrl,
      supplierContactName: suppliers.contactName,
      supplierEmail: suppliers.email,
      supplierPhone: suppliers.phone,
      supplierCountry: suppliers.country,
      branchName: companyBranches.name,
      branchCnpj: companyBranches.cnpj,
      branchAddress: companyBranches.address,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .leftJoin(companyBranches, eq(purchaseOrders.branchId, companyBranches.id))
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
  const money = currencyFormatter(po.currency);

  return (
    <div
      className="min-h-screen bg-white p-12 max-w-[860px] mx-auto"
      style={{ color: INK, fontFamily: "var(--font-inter), Arial, Helvetica, sans-serif" }}
    >
      <PrintButton />

      <div className="h-1.5 -mx-12 -mt-12 mb-10 print:mb-8" style={{ background: ACCENT }} />

      <div className="flex justify-between items-start pb-6 mb-8 border-b" style={{ borderColor: LINE }}>
        <div className="flex items-center gap-4">
          {po.supplierLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- doc estatico de impressao, sem necessidade de otimizacao do next/image
            <img
              src={po.supplierLogoUrl}
              alt={`Logo ${po.supplierName}`}
              className="w-12 h-12 rounded object-contain border"
              style={{ borderColor: LINE }}
            />
          )}
          <div>
            <h1 className="text-[26px] font-bold tracking-tight leading-none">PEDIDO DE COMPRA</h1>
            <p className="text-lg font-semibold mt-1.5" style={{ color: ACCENT, fontVariantNumeric: "tabular-nums" }}>
              Nº {po.poNumber}
            </p>
          </div>
        </div>
        <div className="text-right text-sm space-y-0.5" style={{ color: MUTED }}>
          <p>Data: {formatDate(new Date(po.createdAt).toISOString().slice(0, 10))}</p>
          {po.expectedDeliveryDate && <p>Entrega prevista: {formatDate(po.expectedDeliveryDate)}</p>}
          {po.incoterm && <p>Incoterm: {po.incoterm}</p>}
          {po.currency && <p>Moeda: {po.currency}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: MUTED }}>
            Fornecedor
          </p>
          <p className="text-base font-bold">{po.supplierName}</p>
          {po.supplierContactName && (
            <p className="text-sm mt-0.5" style={{ color: MUTED }}>
              Contato: {po.supplierContactName}
            </p>
          )}
          {po.supplierEmail && (
            <p className="text-sm" style={{ color: MUTED }}>
              {po.supplierEmail}
            </p>
          )}
          {po.supplierPhone && (
            <p className="text-sm" style={{ color: MUTED }}>
              {po.supplierPhone}
            </p>
          )}
          {po.supplierCountry && (
            <p className="text-sm" style={{ color: MUTED }}>
              {po.supplierCountry}
            </p>
          )}
        </div>

        {po.branchName && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: MUTED }}>
              Comprador
            </p>
            <p className="text-base font-bold">{po.branchName}</p>
            <p className="text-sm mt-0.5" style={{ color: MUTED }}>
              CNPJ: {po.branchCnpj}
            </p>
            <p className="text-sm" style={{ color: MUTED }}>
              {po.branchAddress}
            </p>
          </div>
        )}
      </div>

      <table className="w-full text-left border-collapse text-sm mb-8">
        <thead>
          <tr className="border-b-2" style={{ borderColor: INK }}>
            <th className="py-2.5 pr-3 text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
              Item
            </th>
            <th className="py-2.5 pr-3 text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
              SKU Fabricante
            </th>
            <th className="py-2.5 pr-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
              Qtd
            </th>
            <th className="py-2.5 pr-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
              Preço Unit.
            </th>
            <th className="py-2.5 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
              Subtotal
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const subtotal = Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0);
            return (
              <tr key={item.id} className="border-b" style={{ borderColor: LINE }}>
                <td className="py-2.5 pr-3">{item.description}</td>
                <td className="py-2.5 pr-3 text-sm" style={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                  {item.manufacturerSku ?? item.sku ?? "—"}
                </td>
                <td className="py-2.5 pr-3 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {item.quantity ?? "—"}
                </td>
                <td className="py-2.5 pr-3 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {money.format(Number(item.unitPrice ?? 0))}
                </td>
                <td className="py-2.5 text-right font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {money.format(subtotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2" style={{ borderColor: INK }}>
            <td colSpan={4} className="pt-3 pr-3 text-right font-bold">
              Total ({po.currency ?? "—"})
            </td>
            <td className="pt-3 text-right font-bold text-base" style={{ color: ACCENT, fontVariantNumeric: "tabular-nums" }}>
              {money.format(total)}
            </td>
          </tr>
        </tfoot>
      </table>

      {po.notes && (
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: MUTED }}>
            Observações
          </p>
          <p className="text-sm whitespace-pre-wrap">{po.notes}</p>
        </div>
      )}

      <div className="pt-6 mt-4 border-t text-xs text-center" style={{ borderColor: LINE, color: MUTED }}>
        Documento gerado pelo ImportFlow TMS
      </div>
    </div>
  );
}
