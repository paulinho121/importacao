import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import ProductForm from "@/components/ProductForm";
import { updateProduct } from "@/app/produtos/actions";
import { db } from "@/db/client";
import { products, suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";

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

  return (
    <AppShell title="Editar Produto">
      <div className="p-6 md:p-10 max-w-3xl mx-auto w-full">
        <div className="mb-8">
          <h2 className="font-display-lg text-display-lg text-primary">{product.description}</h2>
          <p className="text-on-surface-variant font-body-md text-body-md mt-1">
            Editar dados do produto.
          </p>
        </div>
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
