import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { purchaseOrderDocuments } from "@/db/schema";
import { addPurchaseOrderPackingList, removePurchaseOrderDocument } from "@/app/pedidos-compra/actions";
import ConfirmActionButton from "@/components/ConfirmActionButton";
import DocumentViewer from "@/components/DocumentViewer";
import FileDropzone from "@/components/FileDropzone";

// Packing list do pedido: o arquivo que o fornecedor manda (PDF/Excel) fica
// anexado aqui e, quando o pedido entra num processo, vai junto pra lá. O
// arquivo abre na tela (clique no nome) e pode ser baixado.
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
  const boundAdd = addPurchaseOrderPackingList.bind(null, poId);

  return (
    <section className="bg-surface-container-lowest border border-outline-variant p-gutter rounded-xl shadow-sm">
      <div className="mb-stack-md flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">inventory</span>
        <h3 className="font-headline-sm text-headline-sm text-primary">Packing List</h3>
      </div>

      {docs.length === 0 ? (
        <p className="mb-3 text-body-sm font-body-sm text-on-surface-variant">Nenhuma packing list anexada a este pedido.</p>
      ) : (
        <ul className="mb-3 divide-y divide-outline-variant/50 rounded-lg border border-outline-variant">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-2.5 text-body-sm font-body-sm">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">description</span>
              <DocumentViewer
                src={`/api/pedidos-compra/documentos/${d.id}`}
                fileName={d.fileName}
                className="min-w-0 flex-1 break-all font-medium text-primary"
              />
              <a
                href={`/api/pedidos-compra/documentos/${d.id}?download=1`}
                className="inline-flex items-center gap-0.5 text-xs font-bold text-secondary hover:underline"
              >
                <span className="material-symbols-outlined text-[14px]">download</span>
                Baixar
              </a>
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

      {canEdit && <FileDropzone action={boundAdd} accept=".pdf,.xls,.xlsx,.csv,.png,.jpg,.jpeg" />}
      <p className="mt-2 text-xs text-on-surface-variant">
        {processId
          ? "Este pedido já está em um processo: a packing list também aparece lá."
          : "Ao colocar este pedido em um processo, a packing list vai junto."}
      </p>
    </section>
  );
}
