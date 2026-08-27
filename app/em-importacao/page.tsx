import { db } from "@/db/client";
import { externalImportItems } from "@/db/schema";
import { ilike, or, asc } from "drizzle-orm";
import ExternalImportItemCreatePanel from "@/components/ExternalImportItemCreatePanel";
import ExternalImportItemRow from "@/components/ExternalImportItemRow";

export const dynamic = "force-dynamic";

export default async function EmImportacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  const rows = await db
    .select({
      id: externalImportItems.id,
      sku: externalImportItems.sku,
      description: externalImportItems.description,
      quantity: externalImportItems.quantity,
      supplierName: externalImportItems.supplierName,
      processNumber: externalImportItems.processNumber,
      status: externalImportItems.status,
      modal: externalImportItems.modal,
      invoice: externalImportItems.invoice,
      etd: externalImportItems.etd,
      eta: externalImportItems.eta,
      agent: externalImportItems.agent,
      destination: externalImportItems.destination,
      reservation: externalImportItems.reservation,
      notes: externalImportItems.notes,
    })
    .from(externalImportItems)
    .where(
      q
        ? or(
            ilike(externalImportItems.sku, `%${q}%`),
            ilike(externalImportItems.description, `%${q}%`),
            ilike(externalImportItems.supplierName, `%${q}%`),
            ilike(externalImportItems.processNumber, `%${q}%`),
          )
        : undefined,
    )
    .orderBy(asc(externalImportItems.description));

  return (
    <div className="p-6 md:p-10 max-w-[1300px] mx-auto w-full space-y-stack-lg">
      <div>
        <h2 className="font-display-lg text-display-lg text-primary">Em Importação (Externo)</h2>
        <p className="text-on-surface-variant font-body-md text-body-md mt-1">
          Itens já em processo de importação, controlados fora do sistema. Ao montar um pedido de
          compra, o sistema avisa se o item escolhido já está aqui.
        </p>
      </div>

      <ExternalImportItemCreatePanel />

      <form action="/em-importacao" className="relative max-w-md">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
          search
        </span>
        <input
          className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:border-secondary transition-colors font-body-md text-body-md"
          placeholder="Buscar por SKU, descrição, fornecedor ou processo..."
          type="text"
          name="q"
          defaultValue={q}
        />
      </form>

      <p className="font-label-md text-label-md text-on-surface-variant">
        {rows.length} {rows.length === 1 ? "item" : "itens"}
      </p>

      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">SKU</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">DESCRIÇÃO</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">QTD</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">FORNECEDOR</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">PROCESSO</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">STATUS</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">ETA</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant font-body-sm text-body-sm">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-6 text-on-surface-variant text-center">
                    {q ? "Nenhum item encontrado para essa busca." : "Nenhum item cadastrado ainda."}
                  </td>
                </tr>
              )}
              {rows.map((item) => (
                <ExternalImportItemRow key={item.id} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
