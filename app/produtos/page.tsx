import Link from "next/link";
import AppShell from "@/components/AppShell";
import { db } from "@/db/client";
import { products, suppliers, processItems } from "@/db/schema";
import { eq, ilike, or, sql } from "drizzle-orm";
import { LICENSE_STATUS_LABEL, LICENSE_STATUS_BADGE_CLASS, type LicenseStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      manufacturerSku: products.manufacturerSku,
      ncm: products.ncm,
      ncmDivergent: products.ncmDivergent,
      ncmOfficialSuggested: products.ncmOfficialSuggested,
      description: products.description,
      licenseStatus: products.licenseStatus,
      costPrice: products.costPrice,
      costCurrency: products.costCurrency,
      markupPercent: products.markupPercent,
      supplierName: suppliers.name,
      usageCount: sql<number>`count(${processItems.id})`.mapWith(Number),
    })
    .from(products)
    .leftJoin(suppliers, eq(products.defaultSupplierId, suppliers.id))
    .leftJoin(processItems, eq(processItems.productId, products.id))
    .where(
      q
        ? or(
            ilike(products.sku, `%${q}%`),
            ilike(products.manufacturerSku, `%${q}%`),
            ilike(products.description, `%${q}%`),
            ilike(products.ncm, `%${q}%`),
          )
        : undefined,
    )
    .groupBy(products.id, suppliers.name)
    .orderBy(products.sku);

  return (
    <AppShell title="Produtos">
      <div className="p-6 md:p-10 max-w-[1440px] mx-auto w-full space-y-stack-lg">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="font-display-lg text-display-lg text-primary">Produtos</h2>
            <p className="text-on-surface-variant font-body-md text-body-md mt-1">
              Catálogo mestre com NCM e SKU do fabricante — itens de processo referenciam este
              cadastro em vez de descrição digitada solta.
            </p>
          </div>
          <Link
            href="/produtos/novo"
            className="px-6 py-2.5 rounded-lg bg-secondary text-white font-label-md text-label-md hover:bg-secondary/90 transition-all shadow-sm flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Novo Produto
          </Link>
        </div>

        <form action="/produtos" className="relative max-w-md">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
            search
          </span>
          <input
            className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:border-secondary transition-colors font-body-md text-body-md"
            placeholder="Buscar por SKU interno, SKU fabricante, descrição ou NCM..."
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
                  <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">SKU INTERNO</th>
                  <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">SKU FABRICANTE</th>
                  <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">NCM</th>
                  <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">DESCRIÇÃO</th>
                  <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">FORNECEDOR PADRÃO</th>
                  <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">LICENÇA (INCISO V)</th>
                  <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">CUSTO</th>
                  <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">PREÇO SUGERIDO</th>
                  <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">USOS</th>
                  <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant font-body-sm text-body-sm">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-6 text-on-surface-variant text-center">
                      {q ? "Nenhum produto encontrado para essa busca." : "Nenhum produto cadastrado ainda."}
                    </td>
                  </tr>
                )}
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-container-high transition-colors">
                    <td className="px-6 py-3 font-mono-data">
                      <Link href={`/produtos/${p.id}`} className="text-secondary hover:underline">
                        {p.sku}
                      </Link>
                    </td>
                    <td className="px-6 py-3 font-mono-data">{p.manufacturerSku ?? "—"}</td>
                    <td className="px-6 py-3 font-mono-data">
                      <div className="flex items-center gap-1.5">
                        {p.ncm ?? "—"}
                        {p.ncmDivergent && (
                          <span
                            className="material-symbols-outlined text-[16px] text-warning"
                            title={`Lista oficial do Decex sugere: ${p.ncmOfficialSuggested ?? "—"}`}
                          >
                            warning
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 font-medium">{p.description}</td>
                    <td className="px-6 py-3">{p.supplierName ?? "—"}</td>
                    <td className="px-6 py-3">
                      {p.licenseStatus ? (
                        <span
                          className={`px-2 py-1 rounded-full font-label-md text-label-md ${LICENSE_STATUS_BADGE_CLASS[p.licenseStatus as LicenseStatus]}`}
                        >
                          {LICENSE_STATUS_LABEL[p.licenseStatus as LicenseStatus]}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-3 font-mono-data">
                      {p.costPrice ? `${Number(p.costPrice).toFixed(2)} ${p.costCurrency ?? ""}` : "—"}
                    </td>
                    <td className="px-6 py-3 font-mono-data">
                      {p.costPrice && p.markupPercent
                        ? `${(Number(p.costPrice) * (1 + Number(p.markupPercent) / 100)).toFixed(2)} ${p.costCurrency ?? ""}`
                        : "—"}
                    </td>
                    <td className="px-6 py-3 font-mono-data">{p.usageCount}</td>
                    <td className="px-6 py-3 text-right">
                      <Link
                        href={`/produtos/${p.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-secondary hover:bg-secondary/10 transition-colors font-label-md text-label-md"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
