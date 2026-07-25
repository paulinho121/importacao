import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import AddItemForm from "@/components/AddItemForm";
import { db } from "@/db/client";
import {
  processes,
  suppliers,
  processItems,
  processEvents,
  processDocuments,
  products,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import {
  STATUS_BADGE_CLASS,
  STATUS_LABEL,
  WORKFLOW_STEPS,
  diasRestantes,
  formatDate,
  type ProcessStatus,
} from "@/lib/status";
import {
  advanceProcessStep,
  updateProcessStatus,
  addProcessItem,
  uploadProcessDocument,
} from "@/app/processos/actions";
import { getSignedDocumentUrl } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const DOC_TYPES = [
  { type: "INVOICE" as const, label: "Invoice", icon: "receipt" },
  { type: "BL" as const, label: "BL", icon: "file_open" },
  { type: "PACKING_LIST" as const, label: "Packing List", icon: "inventory" },
];

export default async function ProcessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [process] = await db
    .select({
      id: processes.id,
      processNumber: processes.processNumber,
      externalReference: processes.externalReference,
      status: processes.status,
      modal: processes.modal,
      invoiceNumber: processes.invoiceNumber,
      etd: processes.etd,
      etaEstimated: processes.etaEstimated,
      etaActual: processes.etaActual,
      agent: processes.agent,
      destination: processes.destination,
      currentStep: processes.currentStep,
      weightKg: processes.weightKg,
      volumeM3: processes.volumeM3,
      notes: processes.notes,
      supplierName: suppliers.name,
      supplierId: suppliers.id,
    })
    .from(processes)
    .innerJoin(suppliers, eq(processes.supplierId, suppliers.id))
    .where(eq(processes.id, id));

  if (!process) notFound();

  const [items, events, documents, productRows] = await Promise.all([
    db.select().from(processItems).where(eq(processItems.processId, id)),
    db
      .select()
      .from(processEvents)
      .where(eq(processEvents.processId, id))
      .orderBy(desc(processEvents.eventDate)),
    db.select().from(processDocuments).where(eq(processDocuments.processId, id)),
    db
      .select({ id: products.id, sku: products.sku, description: products.description })
      .from(products)
      .orderBy(products.sku),
  ]);

  const dias = diasRestantes(process.etaEstimated);
  const boundAdvanceStep = advanceProcessStep.bind(null, id);
  const boundUpdateStatus = updateProcessStatus.bind(null, id);
  const boundAddItem = addProcessItem.bind(null, id);
  const nextStepLabel =
    process.currentStep < WORKFLOW_STEPS.length ? WORKFLOW_STEPS[process.currentStep] : null;

  const signedUrlByDocType = new Map<string, string | null>();
  await Promise.all(
    documents
      .filter((d) => d.status === "UPLOADED" && d.storagePath)
      .map(async (d) => {
        signedUrlByDocType.set(d.docType, await getSignedDocumentUrl(d.storagePath!));
      }),
  );

  return (
    <AppShell title="Detalhe do Processo">
      <div className="p-6 md:p-10 max-w-[1440px] mx-auto w-full space-y-stack-lg">
        <div className="flex items-center justify-between">
          <Link
            href="/processos"
            className="flex items-center gap-2 text-secondary font-semibold hover:underline group"
          >
            <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1">
              arrow_back
            </span>
            <span className="font-label-md text-label-md">VOLTAR PARA LISTA</span>
          </Link>
          <div className="hidden sm:flex items-center gap-2 text-on-surface-variant text-sm">
            <span>Processos</span>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-primary font-medium">{process.processNumber}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-stack-md">
          <div className="lg:col-span-8 flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-4 mb-2">
              <h2 className="font-display-lg text-display-lg text-primary">
                Processo #{process.processNumber}
              </h2>
              <span
                className={`px-3 py-1 rounded-full font-bold text-xs uppercase tracking-wider ${STATUS_BADGE_CLASS[process.status as ProcessStatus]}`}
              >
                {STATUS_LABEL[process.status as ProcessStatus]}
              </span>
            </div>
            <p className="text-on-surface-variant font-body-md text-body-md max-w-2xl">
              Fornecedor: {process.supplierName}
              {process.externalReference ? ` · Ref: ${process.externalReference}` : ""}
              {process.destination ? ` · Destino: ${process.destination}` : ""}
            </p>
          </div>
          <div className="lg:col-span-4 flex items-center lg:justify-end">
            <form action={boundUpdateStatus} className="flex items-center gap-2">
              <select
                name="status"
                defaultValue={process.status}
                className="bg-surface-container-low border border-outline-variant rounded-lg p-2 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all appearance-none"
              >
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg border border-outline text-primary font-label-md text-label-md hover:bg-surface-container-high transition-all"
              >
                Alterar Status
              </button>
            </form>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-stack-lg">
          <div className="lg:col-span-4 bg-white border border-outline-variant p-gutter rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-stack-md">
              <h3 className="font-headline-sm text-headline-sm text-primary">Workflow</h3>
              <span className="text-xs text-on-surface-variant font-medium">
                Etapa {process.currentStep} de {WORKFLOW_STEPS.length}
              </span>
            </div>
            <div className="space-y-6 relative ml-2">
              {WORKFLOW_STEPS.map((label, idx) => {
                const step = idx + 1;
                const state =
                  step < process.currentStep
                    ? "done"
                    : step === process.currentStep
                      ? "active"
                      : "pending";
                return (
                  <div key={label} className="relative flex gap-4">
                    <div
                      className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                        state === "done"
                          ? "bg-secondary text-white"
                          : state === "active"
                            ? "border-2 border-secondary bg-white text-secondary"
                            : "border-2 border-outline-variant bg-white text-outline"
                      }`}
                    >
                      {state === "done" ? (
                        <span className="material-symbols-outlined text-sm">check</span>
                      ) : state === "active" ? (
                        <span className="w-2 h-2 rounded-full bg-secondary" />
                      ) : (
                        <span className="text-[10px] font-bold">{step}</span>
                      )}
                    </div>
                    <div>
                      <p
                        className={`font-label-md text-label-md ${
                          state === "active" ? "text-secondary font-bold" : state === "done" ? "text-primary" : "text-outline"
                        }`}
                      >
                        {label}
                      </p>
                      <p className="text-xs text-on-surface-variant italic">
                        {state === "done"
                          ? "Concluído"
                          : state === "active"
                            ? process.etaEstimated
                              ? `Previsão: ${formatDate(process.etaEstimated)}`
                              : "Em andamento"
                            : "Aguardando"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            {nextStepLabel && (
              <form action={boundAdvanceStep} className="mt-6 pt-4 border-t border-outline-variant">
                <button
                  type="submit"
                  className="w-full px-4 py-3 rounded-lg bg-secondary text-white font-bold text-sm shadow-sm hover:opacity-90 active:scale-95 transition-all"
                >
                  Avançar para: {nextStepLabel}
                </button>
              </form>
            )}
          </div>

          <div className="lg:col-span-8 space-y-stack-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-lg">
              <section className="bg-white border border-outline-variant p-gutter rounded-xl shadow-sm">
                <h3 className="font-headline-sm text-headline-sm text-primary mb-stack-md">
                  Dados do Processo
                </h3>
                <dl className="grid grid-cols-1 gap-3 font-body-sm text-body-sm">
                  <Field label="Modal" value={process.modal ?? "—"} />
                  <Field label="Invoice" value={process.invoiceNumber ?? "—"} />
                  <Field label="ETD" value={formatDate(process.etd)} />
                  <Field
                    label="ETA Estimado"
                    value={
                      process.etaEstimated
                        ? `${formatDate(process.etaEstimated)}${dias !== null ? ` (${dias >= 0 ? `faltam ${dias}d` : `${Math.abs(dias)}d atrasado`})` : ""}`
                        : "—"
                    }
                  />
                  <Field label="ETA Real" value={formatDate(process.etaActual)} />
                  <Field label="Agente" value={process.agent ?? "—"} />
                  <Field label="Peso" value={process.weightKg ? `${process.weightKg} kg` : "—"} />
                  <Field label="Volume" value={process.volumeM3 ? `${process.volumeM3} m³` : "—"} />
                </dl>
                {process.notes && (
                  <div className="mt-4 pt-4 border-t border-outline-variant">
                    <span className="font-label-md text-label-md text-outline block mb-1">
                      Observações
                    </span>
                    <p className="text-body-sm font-body-sm text-on-surface-variant whitespace-pre-wrap">
                      {process.notes}
                    </p>
                  </div>
                )}
              </section>

              <section className="bg-white border border-outline-variant p-gutter rounded-xl shadow-sm">
                <h3 className="font-headline-sm text-headline-sm text-primary mb-stack-md">
                  Itens do Processo
                </h3>
                {items.length === 0 ? (
                  <p className="text-on-surface-variant font-body-sm text-body-sm">
                    Nenhum item registrado.
                  </p>
                ) : (
                  <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="flex justify-between items-start gap-2 text-body-sm font-body-sm border-b border-outline-variant/50 pb-2"
                      >
                        <div>
                          <p className="font-medium text-primary">{item.description}</p>
                          {item.sku && (
                            <p className="text-xs text-outline font-mono-data">SKU: {item.sku}</p>
                          )}
                          {item.reservedTo && (
                            <p className="text-xs text-on-surface-variant">Reserva: {item.reservedTo}</p>
                          )}
                        </div>
                        <span className="font-bold text-primary shrink-0">
                          {item.quantity ?? "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <AddItemForm action={boundAddItem} products={productRows} />
              </section>
            </div>

            <section className="bg-white border border-outline-variant p-gutter rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-stack-md">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">description</span>
                  <h3 className="font-headline-sm text-headline-sm text-primary">Documentos</h3>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {DOC_TYPES.map(({ type, label, icon }) => {
                  const doc = documents.find((d) => d.docType === type);
                  const uploaded = doc?.status === "UPLOADED";
                  const signedUrl = signedUrlByDocType.get(type);
                  const boundUpload = uploadProcessDocument.bind(null, id, type);
                  return (
                    <div
                      key={type}
                      className={`relative p-4 rounded-lg flex flex-col items-center text-center gap-2 ${
                        uploaded
                          ? "border border-outline-variant bg-surface-container-lowest"
                          : "border border-dashed border-outline"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-4xl ${uploaded ? "text-primary" : "text-on-surface-variant"}`}
                      >
                        {icon}
                      </span>
                      <span className="font-bold text-sm">{label}</span>
                      <span
                        className={`text-xs break-all ${uploaded ? "text-on-surface-variant" : "text-error font-medium"}`}
                      >
                        {uploaded ? doc?.fileName ?? "Enviado" : "Pendente de envio"}
                      </span>
                      {uploaded && signedUrl && (
                        <a
                          href={signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-secondary hover:underline"
                        >
                          Visualizar
                        </a>
                      )}
                      <form action={boundUpload} className="w-full flex flex-col items-center gap-1.5 mt-1">
                        <input
                          type="file"
                          name="file"
                          required
                          className="w-full text-[11px] file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-surface-container-high file:text-on-surface-variant"
                        />
                        <button
                          type="submit"
                          className="w-full px-3 py-1.5 rounded-lg bg-secondary text-white text-xs font-bold hover:opacity-90 transition-all"
                        >
                          {uploaded ? "Substituir" : "Enviar"}
                        </button>
                      </form>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden">
              <div className="px-gutter py-4 bg-surface-container flex items-center justify-between">
                <h3 className="font-label-md text-label-md text-primary uppercase tracking-wider">
                  Histórico de Eventos
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant">
                      <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">DATA/HORA</th>
                      <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">EVENTO</th>
                      <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">ORIGEM</th>
                      <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant font-body-sm text-body-sm">
                    {events.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-on-surface-variant">
                          Nenhum evento registrado.
                        </td>
                      </tr>
                    )}
                    {events.map((ev) => (
                      <tr key={ev.id} className="hover:bg-surface-container-high transition-colors">
                        <td className="px-6 py-3 font-mono-data">
                          {new Date(ev.eventDate).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-6 py-3 font-medium">{ev.eventType}</td>
                        <td className="px-6 py-3">{ev.origin ?? "—"}</td>
                        <td className="px-6 py-3">
                          {ev.statusAtEvent ? STATUS_LABEL[ev.statusAtEvent as ProcessStatus] : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-label-md text-label-md text-outline block">{label}</span>
      <span className="text-on-surface font-medium">{value}</span>
    </div>
  );
}
