import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { purchaseOrderDocuments } from "@/db/schema";
import { addPurchaseOrderPackingList, removePurchaseOrderDocument } from "@/app/pedidos-compra/actions";
import { getSignedDocumentUrl } from "@/lib/supabase-admin";
import ConfirmActionButton from "@/components/ConfirmActionButton";

// Packing list do pedido: o arquivo que o fornecedor manda (PDF/Excel) fica
// anexado aqui e, quando o pedido entra num processo, vai junto pra lá.
export default async function PurchaseOrderPackingList({
  poId,
  processId,
  canEdit,
}: {
  poId: string;
  processId: string | null;
  canEdit: boolean;
}) {
  const docs = await db
    .select()
    .from(purchaseOrderDocuments)
    .where(eq(purchaseOrderDocuments.purchaseOrderId, poId))
    .orderBy(asc(purchaseOrderDocuments.uploadedAt));
  // 1h: a página pode ficar aberta um tempo antes do clique em "Visualizar"
  const urls = await Promise.all(docs.map((d) => getSignedDocumentUrl(d.storagePath, 3600)));
  const boundAdd = addPurchaseOrderPackingList.bind(null, poId);

  return (
    <section className="bg-surface-container-lowest border border-outline-variant p-gutter rounded-xl shadow-sm">
      <div className="mb-stack-md flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">inventory</span>
        <h3 className="font-headline-sm text-headline-sm text-primary">Packing List</h3>
      </div>

      {docs.length === 0 ? (
        <p className="text-body-sm font-body-sm text-on-surface-variant">Nenhuma packing list anexada a este pedido.</p>
      ) : (
        <ul className="divide-y divide-outline-variant/50 rounded-lg border border-outline-variant">
          {docs.map((d, i) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-2.5 text-body-sm font-body-sm">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">description</span>
              <span className="min-w-0 flex-1 break-all">{d.fileName}</span>
              {urls[i] && (
                <a href={urls[i]!} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-secondary hover:underline">
                  Visualizar
                </a>
              )}
              {canEdit && (
                <ConfirmActionButton
                  action={removePurchaseOrderDocument.bind(null, d.id, poId)}
                  label="Remover"
                  message={`Remover o arquivo ${d.fileName}?`}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form action={boundAdd} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="file"
            name="file"
            multiple
            required
            accept=".pdf,.xls,.xlsx,.csv,.png,.jpg,.jpeg"
            className="w-full flex-1 text-xs file:mr-2 file:rounded file:border-0 file:bg-surface-container-high file:px-3 file:py-2 file:text-on-surface-variant"
          />
          <button
            type="submit"
            className="rounded-lg bg-secondary px-4 py-2 font-label-md text-label-md text-white transition-all hover:opacity-90"
          >
            Anexar packing list
          </button>
        </form>
      )}
      <p className="mt-2 text-xs text-on-surface-variant">
        {processId
          ? "Este pedido já está em um processo: a packing list também aparece lá."
          : "Ao colocar este pedido em um processo, a packing list vai junto."}
      </p>
    </section>
  );
}
