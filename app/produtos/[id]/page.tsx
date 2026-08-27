import { notFound } from "next/navigation";
import ProductForm from "@/components/ProductForm";
import { updateProduct, resolveNcmDivergence, addPriceTier, removePriceTier } from "@/app/produtos/actions";
import { db } from "@/db/client";
import { products, suppliers, productPriceTiers } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
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

  const [supplierRows, tiers] = await Promise.all([
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).orderBy(suppliers.name),
    db
      .select()
      .from(productPriceTiers)
      .where(eq(productPriceTiers.productId, id))
      .orderBy(asc(productPriceTiers.minQuantity)),
  ]);

  const boundUpdate = updateProduct.bind(null, id);
  const boundResolveNcm = resolveNcmDivergence.bind(null, id);
  const boundAddTier = addPriceTier.bind(null, id);

  return (
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
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 mb-6">
        <h3 className="font-headline-sm text-headline-sm text-primary mb-1">Faixas de Preço por Quantidade</h3>
        <p className="text-on-surface-variant font-body-sm text-body-sm mb-4">
          Preço de compra em volume (ex: fornecedor cobra menos a partir de 100 unidades). A maior
          faixa que a quantidade do pedido alcançar é usada automaticamente ao montar um Pedido de
          Compra — sem faixa aplicável, usa o custo padrão (
          {product.costPrice ? `${Number(product.costPrice).toFixed(2)} ${product.costCurrency ?? ""}` : "não cadastrado"}
          ).
        </p>

        {tiers.length > 0 && (
          <table className="w-full text-left border-collapse text-sm mb-4">
            <thead>
              <tr className="border-b border-outline-variant text-on-surface-variant text-xs">
                <th className="py-2 pr-3 font-label-md">A PARTIR DE</th>
                <th className="py-2 pr-3 font-label-md">PREÇO UNIT.</th>
                <th className="py-2 font-label-md text-right">​</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50 font-mono-data">
              {tiers.map((tier) => {
                const boundRemove = removePriceTier.bind(null, tier.id, id);
                return (
                  <tr key={tier.id}>
                    <td className="py-2 pr-3">{Number(tier.minQuantity)} un.</td>
                    <td className="py-2 pr-3">
                      {Number(tier.price).toFixed(2)} {product.costCurrency ?? ""}
                    </td>
                    <td className="py-2 text-right">
                      <form action={boundRemove}>
                        <button type="submit" className="text-error hover:underline text-xs">
                          Remover
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <form action={boundAddTier} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block font-label-md text-label-md text-on-surface-variant mb-1">
              A partir de (unidades)
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
              type="number"
              step="1"
              min="1"
              name="minQuantity"
              required
            />
          </div>
          <div className="flex-1">
            <label className="block font-label-md text-label-md text-on-surface-variant mb-1">
              Preço unitário {product.costCurrency ? `(${product.costCurrency})` : ""}
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm font-mono-data focus:outline-none focus:border-secondary transition-all"
              type="number"
              step="0.01"
              min="0"
              name="price"
              required
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all"
          >
            Adicionar
          </button>
        </form>
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
            taxRateII: product.taxRateII,
            taxRateIPI: product.taxRateIPI,
            taxRatePIS: product.taxRatePIS,
            taxRateCOFINS: product.taxRateCOFINS,
            taxRateICMS: product.taxRateICMS,
          }}
          submitLabel="Salvar Alterações"
          suppliers={supplierRows}
        />
      </div>
    </div>
  );
}
