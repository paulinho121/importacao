import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { purchaseOrders, purchaseOrderItems, suppliers, products, companyBranches } from "@/db/schema";
import { eq } from "drizzle-orm";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

// Cores fixas (nao usam os tokens de tema claro/escuro do app) porque este
// documento e impresso/exportado em PDF e precisa ficar sempre igual,
// independente do tema que o usuario tiver escolhido na tela.
const INK = "#0f172a";
const ACCENT = "#2abf9c";
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

// Documento sempre em inglês (pedido é enviado a fornecedores estrangeiros)
// — por isso usa seu próprio formatador de data em vez de lib/status.ts
// formatDate, que é pt-BR (usado no resto do app, que fica em português).
function formatDateEN(value: string | Date | null) {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(`${value}T00:00:00Z`) : value;
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
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
      paymentTerms: purchaseOrders.paymentTerms,
      expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
      notes: purchaseOrders.notes,
      createdAt: purchaseOrders.createdAt,
      supplierName: suppliers.name,
      supplierLogoUrl: suppliers.logoUrl,
      supplierContactName: suppliers.contactName,
      supplierEmail: suppliers.email,
      supplierPhone: suppliers.phone,
      supplierFax: suppliers.fax,
      supplierCountry: suppliers.country,
      manufacturerAddress: suppliers.manufacturerAddress,
      exporterName: suppliers.exporterName,
      exporterAddress: suppliers.exporterAddress,
      bankBeneficiary: suppliers.bankBeneficiary,
      bankAccount: suppliers.bankAccount,
      bankName: suppliers.bankName,
      bankAddress: suppliers.bankAddress,
      swiftCode: suppliers.swiftCode,
      paymentInstructions: suppliers.paymentInstructions,
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
            <h1 className="text-[26px] font-bold tracking-tight leading-none">PURCHASE ORDER</h1>
            <p className="text-lg font-semibold mt-1.5" style={{ color: ACCENT, fontVariantNumeric: "tabular-nums" }}>
              No. {po.poNumber}
            </p>
          </div>
        </div>
        <div className="text-right text-xs space-y-0.5" style={{ color: MUTED }}>
          <p>Date: {formatDateEN(po.createdAt)}</p>
          {po.expectedDeliveryDate && <p>Expected Delivery: {formatDateEN(po.expectedDeliveryDate)}</p>}
          {po.incoterm && <p>Incoterm: {po.incoterm}</p>}
          {po.currency && <p>Currency: {po.currency}</p>}
          {po.paymentTerms && <p>Payment Terms: {po.paymentTerms}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: MUTED }}>
            Supplier
          </p>
          <p className="text-sm font-bold">{po.supplierName}</p>
          {po.manufacturerAddress && (
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>
              Add: {po.manufacturerAddress}
            </p>
          )}
          {po.supplierCountry && !po.manufacturerAddress && (
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>
              {po.supplierCountry}
            </p>
          )}
          {po.supplierContactName && (
            <p className="text-xs mt-1.5" style={{ color: MUTED }}>
              Attn: {po.supplierContactName}
            </p>
          )}
          {po.supplierEmail && (
            <p className="text-xs" style={{ color: MUTED }}>
              Email: {po.supplierEmail}
            </p>
          )}
          {po.supplierPhone && (
            <p className="text-xs" style={{ color: MUTED }}>
              Tel: {po.supplierPhone}
            </p>
          )}
          {po.supplierFax && (
            <p className="text-xs" style={{ color: MUTED }}>
              Fax: {po.supplierFax}
            </p>
          )}

          {po.exporterName && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: LINE }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: MUTED }}>
                Exporter
              </p>
              <p className="text-sm font-semibold">{po.exporterName}</p>
              {po.exporterAddress && (
                <p className="text-xs" style={{ color: MUTED }}>
                  {po.exporterAddress}
                </p>
              )}
            </div>
          )}
        </div>

        {po.branchName && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: MUTED }}>
              Buyer
            </p>
            <p className="text-sm font-bold">{po.branchName}</p>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>
              CNPJ: {po.branchCnpj}
            </p>
            <p className="text-xs" style={{ color: MUTED }}>
              {po.branchAddress}
            </p>
          </div>
        )}
      </div>

      <table className="w-full text-left border-collapse text-base mb-8">
        <thead>
          <tr className="border-b-2" style={{ borderColor: INK }}>
            <th className="py-3 pr-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
              #
            </th>
            <th className="py-3 pr-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
              Description
            </th>
            <th className="py-3 pr-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
              Code
            </th>
            <th className="py-3 pr-3 text-right text-[10px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
              Qty
            </th>
            <th className="py-3 pr-3 text-right text-[10px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
              Unit Price
            </th>
            <th className="py-3 text-right text-[10px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const subtotal = Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0);
            return (
              <tr key={item.id} className="border-b" style={{ borderColor: LINE }}>
                <td className="py-3 pr-3 text-sm" style={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                  {idx + 1}
                </td>
                <td className="py-3 pr-3 font-medium">{item.description}</td>
                <td className="py-3 pr-3 text-xs" style={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                  {item.manufacturerSku ?? item.sku ?? "—"}
                </td>
                <td className="py-3 pr-3 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {item.quantity ?? "—"}
                </td>
                <td className="py-3 pr-3 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {money.format(Number(item.unitPrice ?? 0))}
                </td>
                <td className="py-3 text-right font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {money.format(subtotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2" style={{ borderColor: INK }}>
            <td colSpan={5} className="pt-3 pr-3 text-right font-bold text-sm">
              Total ({po.currency ?? "—"})
            </td>
            <td className="pt-3 text-right font-bold text-lg" style={{ color: ACCENT, fontVariantNumeric: "tabular-nums" }}>
              {money.format(total)}
            </td>
          </tr>
        </tfoot>
      </table>

      {(po.bankBeneficiary || po.bankAccount) && (
        <div className="mb-6 p-4 rounded-lg" style={{ background: "#f0f9ff", border: `1px solid ${LINE}` }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: MUTED }}>
            {po.currency ?? ""} Pay To
          </p>
          <div className="text-xs space-y-1">
            {po.bankBeneficiary && (
              <p>
                <span style={{ color: MUTED }}>Beneficiary: </span>
                <span className="font-semibold">{po.bankBeneficiary}</span>
              </p>
            )}
            {po.bankAccount && (
              <p>
                <span style={{ color: MUTED }}>Beneficiary Account: </span>
                <span className="font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {po.bankAccount}
                </span>
              </p>
            )}
            {po.bankName && (
              <p>
                <span style={{ color: MUTED }}>Bank Name: </span>
                {po.bankName}
              </p>
            )}
            {po.bankAddress && (
              <p>
                <span style={{ color: MUTED }}>Bank Address: </span>
                {po.bankAddress}
              </p>
            )}
            {po.swiftCode && (
              <p>
                <span style={{ color: MUTED }}>SWIFT Code: </span>
                <span className="font-semibold">{po.swiftCode}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {po.paymentInstructions && (
        <div className="mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: MUTED }}>
            Your Attention Please
          </p>
          <p className="text-xs whitespace-pre-wrap" style={{ color: MUTED }}>
            {po.paymentInstructions}
          </p>
        </div>
      )}

      {po.notes && (
        <div className="mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: MUTED }}>
            Notes
          </p>
          <p className="text-xs whitespace-pre-wrap">{po.notes}</p>
        </div>
      )}

      <div className="pt-6 mt-4 border-t text-xs text-center" style={{ borderColor: LINE, color: MUTED }}>
        Document generated by ImportFlow TMS
      </div>
    </div>
  );
}
