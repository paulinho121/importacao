import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { purchaseOrderDocuments, purchaseOrders } from "@/db/schema";
import { removePurchaseOrderDocument, savePurchaseOrderLinks } from "@/app/pedidos-compra/actions";
import ConfirmActionButton from "@/components/ConfirmActionButton";
import DocumentViewer from "@/components/DocumentViewer";
import SubmitButton from "@/components/SubmitButton";
import { driveDownloadUrl } from "@/lib/drive-links";

// Packing list e invoice do pedido: em vez de enviar o arquivo, o time cola aqui o
// link do Google Drive de cada um (com botão para baixar direto). Arquivos que já
// tinham sido anexados antes continuam listados e podem ser removidos.
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
  const [links] = await db
    .select({ packingListUrl: purchaseOrders.packingListUrl, invoiceUrl: purchaseOrders.invoiceUrl })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, poId));
  const boundSave = savePurchaseOrderLinks.bind(null, poId);
  const fields = [
    { name: "packingListUrl", label: "Packing List", value: links?.packingListUrl ?? "" },
    { name: "invoiceUrl", label: "Invoice", value: links?.invoiceUrl ?? "" },
  ];

  return (
    <section className="bg-surface-container-lowest border border-outline-variant p-gutter rounded-xl shadow-sm">
      <div className="mb-stack-md flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">inventory</span>
        <h3 className="font-headline-sm text-headline-sm text-primary">Packing List e Invoice</h3>
      </div>

      {docs.length > 0 && (
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

      <form action={boundSave} className="space-y-3">
        {fields.map((f) => {
          const href = driveDownloadUrl(f.value);
          return (
            <div key={f.name}>
              <label htmlFor={`po-${f.name}`} className="mb-1 block font-label-md text-label-md text-on-surface-variant">
                Link da {f.label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`po-${f.name}`}
                  type="url"
                  name={f.name}
                  defaultValue={f.value}
                  disabled={!canEdit}
                  placeholder="Cole o link do Google Drive"
                  className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm font-body-sm focus:border-secondary focus:outline-none disabled:opacity-60"
                />
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Baixar a ${f.label.toLowerCase()} do Google Drive`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-white hover:opacity-90"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    Baixar
                  </a>
                )}
              </div>
            </div>
          );
        })}
        {canEdit && (
          <SubmitButton className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold text-white transition-all hover:opacity-90">
            Salvar links
          </SubmitButton>
        )}
      </form>
      <p className="mt-2 text-xs text-on-surface-variant">
        {processId
          ? "Este pedido já está em um processo: os links também aparecem lá."
          : "Ao colocar este pedido em um processo, os links vão junto."}
      </p>
    </section>
  );
}
