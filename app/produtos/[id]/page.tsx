import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import ProductForm from "@/components/ProductForm";
import { updateProduct, resolveNcmDivergence } from "@/app/produtos/actions";
import { db } from "@/db/client";
import { products, suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatDate } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function EditProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product] = await db.select().from(products).where(eq(products.id, id));

  if (!product) notFound();

  const supplierRows = await db
    .select({ id: suppliers.id, name: suppliers.name })
    .from(suppliers)
    .orderBy(suppliers.name);

  const boundUpdate = updateProduct.bind(null, id);
  const boundResolveNcm = resolveNcmDivergence.bind(null, id);

  return (
    <AppShell title="Editar Produto">
      <div className="p-6 md:p-10 max-w-3xl mx-auto w-full">
        <div className="mb-8">
          <h2 className="font-display-lg text-display-lg text-primary">{product.description}</h2>
          <p className="text-on-surface-variant font-body-md text-body-md mt-1">
            Editar dados do produto.
          </p>
        </div>
        {product.ncmDivergent && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-6 mb-6 flex gap-4">
            <span className="material-symbols-outlined text-warning text-[24px] shrink-0">warning</span>
            <div className="flex-1 space-y-3">
              <div>
                <p className="font-label-md text-label-md text-warning">NCM divergente da lista oficial do Decex</p>
                <p className="text-on-surface-variant font-body-sm text-body-sm mt-1">
                  Cadastrado: <span className="font-mono-data">{product.ncm ?? "—"}</span> · Lista oficial (
                  {formatDate(product.ncmCheckedAt)}):{" "}
                  <span className="font-mono-data">{product.ncmOfficialSuggested ?? "—"}</span>
                </p>
              </div>
              <div className="flex gap-3">
                <form action={boundResolveNcm}>
                  <input type="hidden" name="action" value="accept" />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-warning text-warning-foreground font-label-md text-label-md hover:opacity-90 transition-all"
                  >
                    Usar NCM oficial
                  </button>
                </form>
                <form action={boundResolveNcm}>
                  <input type="hidden" name="action" value="dismiss" />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg border border-outline-variant font-label-md text-label-md hover:bg-surface-container transition-all"
                  >
                    Manter o atual
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8">
          <ProductForm
            action={boundUpdate}
            defaultValues={{
              sku: product.sku,
              manufacturerSku: product.manufacturerSku,
              ncm: product.ncm,
              description: product.description,
              defaultSupplierId: product.defaultSupplierId,
              costPrice: product.costPrice,
              costCurrency: product.costCurrency,
              markupPercent: product.markupPercent,
              ncmAnterior: product.ncmAnterior,
              manufacturerName: product.manufacturerName,
              exporterName: product.exporterName,
              licenseNumber: product.licenseNumber,
              licenseRegisteredAt: product.licenseRegisteredAt,
              licenseStatus: product.licenseStatus,
              publicConsultationRef: product.publicConsultationRef,
              licenseApprovedAt: product.licenseApprovedAt,
              customsBrokerRef: product.customsBrokerRef,
              active: product.active,
            }}
            submitLabel="Salvar Alterações"
            suppliers={supplierRows}
          />
        </div>
      </div>
    </AppShell>
  );
}
