import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import AddItemForm from "@/components/AddItemForm";
import VesselTracker from "@/components/VesselTracker";
import ProcessFinancials from "@/components/ProcessFinancials";
import ProcessCompliance from "@/components/ProcessCompliance";
import LandedCostBreakdown from "@/components/LandedCostBreakdown";
import ProcessPayables from "@/components/ProcessPayables";
import SupplierLogo from "@/components/SupplierLogo";
import { db } from "@/db/client";
import {
  processes,
  suppliers,
  processItems,
  processEvents,
  processDocuments,
  products,
  processInvoices,
  processLpcos,
  processPayables,
  freightAgents,
  itemReservations,
} from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import {
  STATUS_BADGE_CLASS,
  STATUS_LABEL,
  WORKFLOW_STEPS,
  diasRestantes,
  formatDate,
  stockStatus,
  type ProcessStatus,
} from "@/lib/status";
import { locationLabel } from "@/lib/locations";
import {
  advanceProcessStep,
  updateProcessStatus,
  updateProcessNumber,
  addProcessItem,
  addProcessInvoice,
  addItemReservation,
  updateProcessItemValue,
  uploadProcessDocument,
} from "@/app/processos/actions";
import { createPayable } from "@/app/financeiro/actions";
import { getSignedDocumentUrl } from "@/lib/supabase-admin";
import { calcValorAduaneiro, calcLandedCostByItem } from "@/lib/landed-cost";
import { getCurrentUser } from "@/lib/supabase-server";

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
      etd: processes.etd,
      etaEstimated: processes.etaEstimated,
      etaActual: processes.etaActual,
      agentName: freightAgents.name,
      destination: processes.destination,
      destinationCode: processes.destinationCode,
      destinationCity: processes.destinationCity,
      destinationState: processes.destinationState,
      currentStep: processes.currentStep,
      weightKg: processes.weightKg,
      volumeM3: processes.volumeM3,
      notes: processes.notes,
      currency: processes.currency,
      incoterm: processes.incoterm,
      internationalFreightValue: processes.internationalFreightValue,
      insuranceValue: processes.insuranceValue,
      exchangeRate: processes.exchangeRate,
      exchangeRateDate: processes.exchangeRateDate,
      customsChannel: processes.customsChannel,
      vesselName: processes.vesselName,
      vesselImo: processes.vesselImo,
      vesselMmsi: processes.vesselMmsi,
      vesselLat: processes.vesselLat,
      vesselLon: processes.vesselLon,
      vesselSpeedKnots: processes.vesselSpeedKnots,
      vesselHeading: processes.vesselHeading,
      vesselDestination: processes.vesselDestination,
      vesselPositionUpdatedAt: processes.vesselPositionUpdatedAt,
      supplierName: suppliers.name,
      supplierId: suppliers.id,
      supplierLogoUrl: suppliers.logoUrl,
    })
    .from(processes)
    .innerJoin(suppliers, eq(processes.supplierId, suppliers.id))
    .leftJoin(freightAgents, eq(processes.agentId, freightAgents.id))
    .where(eq(processes.id, id));

  if (!process) notFound();

  const [items, events, documents, productRows, invoices, lpcos, payables] = await Promise.all([
    db
      .select({
        id: processItems.id,
        productId: processItems.productId,
        sku: processItems.sku,
        description: processItems.description,
        quantity: processItems.quantity,
        unitValueOverride: processItems.unitValueOverride,
        reservedTo: processItems.reservedTo,
        productCostPrice: products.costPrice,
        productTaxRateII: products.taxRateII,
        productTaxRateIPI: products.taxRateIPI,
        productTaxRatePIS: products.taxRatePIS,
        productTaxRateCOFINS: products.taxRateCOFINS,
        productTaxRateICMS: products.taxRateICMS,
      })
      .from(processItems)
      .leftJoin(products, eq(processItems.productId, products.id))
      .where(eq(processItems.processId, id)),
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
    db.select().from(processInvoices).where(eq(processInvoices.processId, id)),
    db.select().from(processLpcos).where(eq(processLpcos.processId, id)),
    db
      .select()
      .from(processPayables)
      .where(eq(processPayables.processId, id))
      .orderBy(processPayables.dueDate),
  ]);

  const itemIds = items.map((item) => item.id);
  const reservations = itemIds.length
    ? await db.select().from(itemReservations).where(inArray(itemReservations.itemId, itemIds))
    : [];
  const reservationsByItemId = new Map<string, typeof reservations>();
  for (const r of reservations) {
    const list = reservationsByItemId.get(r.itemId) ?? [];
    list.push(r);
    reservationsByItemId.set(r.itemId, list);
  }

  const dias = diasRestantes(process.etaEstimated);
  const boundAdvanceStep = advanceProcessStep.bind(null, id);
  const boundUpdateStatus = updateProcessStatus.bind(null, id);
  const boundUpdateProcessNumber = updateProcessNumber.bind(null, id);
  const boundAddItem = addProcessItem.bind(null, id);
  const boundAddInvoice = addProcessInvoice.bind(null, id);
  const boundCreatePayable = createPayable.bind(null, id);
  const currentUser = await getCurrentUser();
  const isAdmin = currentUser?.role === "ADMIN";

  // Custo pousado por item — só calcula quando há câmbio (mesma condição
  // já usada em ProcessFinancials pro Valor Aduaneiro estimado).
  const rate = process.exchangeRate ? Number(process.exchangeRate) : null;
  const invoicesSum = invoices.reduce((sum, inv) => sum + Number(inv.value ?? 0), 0);
  const freight = Number(process.internationalFreightValue ?? 0);
  const insurance = Number(process.insuranceValue ?? 0);
  const valorAduaneiro = rate !== null ? calcValorAduaneiro({ invoicesSum, freight, insurance, rate }) : null;
  const payablesBRL = payables.reduce((sum, p) => {
    const amount = Number(p.amount);
    // BRL já está na moeda certa; moeda estrangeira usa o mesmo câmbio do
    // processo (não dá pra ter câmbio por conta a pagar individual).
    return sum + (p.currency === "BRL" || !rate ? amount : amount * rate);
  }, 0);
  const landedCost =
    valorAduaneiro !== null
      ? calcLandedCostByItem({
          items: items.map((item) => ({
            id: item.id,
            sku: item.sku,
            description: item.description,
            quantity: item.quantity,
            unitValueOverride: item.unitValueOverride,
            product: item.productId
              ? {
                  costPrice: item.productCostPrice,
                  taxRateII: item.productTaxRateII,
                  taxRateIPI: item.productTaxRateIPI,
                  taxRatePIS: item.productTaxRatePIS,
                  taxRateCOFINS: item.productTaxRateCOFINS,
                  taxRateICMS: item.productTaxRateICMS,
                }
              : null,
          })),
          valorAduaneiro,
          payablesBRL,
        })
      : null;
  const destinationLabel = process.destinationCode
    ? locationLabel(process.destinationCode, process.destinationCity ?? "", process.destinationState ?? "")
    : process.destination;
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
              <details className="relative">
                <summary className="list-none cursor-pointer flex items-center gap-1 text-secondary hover:underline font-label-md text-label-md">
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  Editar número
                </summary>
                <form
                  action={boundUpdateProcessNumber}
                  className="absolute z-10 mt-2 flex items-center gap-2 bg-surface-container-lowest border border-outline-variant rounded-xl p-3 shadow-lg"
                >
                  <input
                    type="text"
                    name="processNumber"
                    defaultValue={process.processNumber}
                    required
                    className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all"
                  >
                    Salvar
                  </button>
                </form>
              </details>
            </div>
            <p className="text-on-surface-variant font-body-sm text-body-sm -mt-1 mb-2">
              Use isso pra renomear o número quando precisar mesclar dois ou mais processos em um só —
              itens, invoices e documentos ficam associados ao processo, não ao número.
            </p>
            <p className="flex items-center gap-2 text-on-surface-variant font-body-md text-body-md max-w-2xl">
              <SupplierLogo
                logoUrl={process.supplierLogoUrl}
                name={process.supplierName}
                size={20}
              />
              Fornecedor: {process.supplierName}
              {process.externalReference ? ` · Ref: ${process.externalReference}` : ""}
              {destinationLabel ? ` · Destino: ${destinationLabel}` : ""}
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
                  <Field label="Agente" value={process.agentName ?? "—"} />
                  <Field label="Peso" value={process.weightKg ? `${process.weightKg} kg` : "—"} />
                  <Field label="Volume" value={process.volumeM3 ? `${process.volumeM3} m³` : "—"} />
                </dl>

                <div className="mt-4 pt-4 border-t border-outline-variant">
                  <span className="font-label-md text-label-md text-outline block mb-2">
                    Invoices
                  </span>
                  {invoices.length === 0 ? (
                    <p className="text-on-surface-variant font-body-sm text-body-sm mb-2">
                      Nenhuma invoice registrada.
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-2 mb-3">
                      {invoices.map((inv) => (
                        <li
                          key={inv.id}
                          className="px-2 py-1 rounded bg-surface-container-low font-mono-data text-xs"
                        >
                          {inv.invoiceNumber}
                        </li>
                      ))}
                    </ul>
                  )}
                  <form action={boundAddInvoice} className="flex gap-2">
                    <input
                      className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg p-2 text-body-sm font-body-sm font-mono-data focus:outline-none focus:border-secondary transition-all"
                      placeholder="Nova invoice"
                      type="text"
                      name="invoiceNumber"
                      required
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 rounded-lg border border-outline text-primary text-xs font-bold hover:bg-surface-container-high transition-all"
                    >
                      Adicionar
                    </button>
                  </form>
                </div>
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
                  <ul className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {items.map((item) => {
                      const itemReservationsList = reservationsByItemId.get(item.id) ?? [];
                      const total = item.quantity ? Number(item.quantity) : 0;
                      const reserved = itemReservationsList.reduce(
                        (sum, r) => sum + Number(r.quantity),
                        0,
                      );
                      const available = total - reserved;
                      const badge = stockStatus(available, total);
                      const boundReserve = addItemReservation.bind(null, id, item.id);
                      const boundUpdateValue = updateProcessItemValue.bind(null, item.id, id);
                      return (
                        <li
                          key={item.id}
                          className="text-body-sm font-body-sm border-b border-outline-variant/50 pb-3"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="font-medium text-primary">{item.description}</p>
                              {item.sku && (
                                <p className="text-xs text-outline font-mono-data">SKU: {item.sku}</p>
                              )}
                              {item.reservedTo && (
                                <p className="text-xs text-on-surface-variant">
                                  Reserva (planilha): {item.reservedTo}
                                </p>
                              )}
                            </div>
                            <span className="font-bold text-primary shrink-0">{total || "—"}</span>
                          </div>
                          <details className="mt-1.5">
                            <summary className="cursor-pointer text-xs text-secondary hover:underline list-none inline-flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">edit</span>
                              Valor unitário{item.unitValueOverride ? `: ${item.unitValueOverride}` : ""}
                            </summary>
                            <form action={boundUpdateValue} className="flex gap-1.5 mt-1.5">
                              <input
                                className="w-28 bg-surface-container-low border border-outline-variant rounded-lg p-1.5 text-xs focus:outline-none focus:border-secondary transition-all"
                                placeholder="Valor unitário"
                                type="number"
                                step="0.01"
                                name="unitValueOverride"
                                defaultValue={item.unitValueOverride ?? ""}
                              />
                              <button
                                type="submit"
                                className="px-3 py-1.5 rounded-lg bg-secondary text-white text-xs font-bold hover:opacity-90 transition-all"
                              >
                                Salvar
                              </button>
                            </form>
                          </details>
                          {total > 0 && (
                            <>
                              <div className="flex items-center gap-3 mt-2 text-xs">
                                <span className={`px-2 py-0.5 rounded-full ${badge.className}`}>
                                  {badge.label}
                                </span>
                                <span className="text-on-surface-variant">
                                  Pedido: {total} · Reservado: {reserved} · Disponível: {available}
                                </span>
                              </div>
                              {itemReservationsList.length > 0 && (
                                <ul className="mt-2 space-y-1">
                                  {itemReservationsList.map((r) => (
                                    <li key={r.id} className="text-xs text-on-surface-variant">
                                      {r.personName} — {r.quantity}
                                      {r.observation ? ` (${r.observation})` : ""}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <form action={boundReserve} className="flex gap-1.5 mt-2">
                                <input
                                  className="w-24 bg-surface-container-low border border-outline-variant rounded-lg p-1.5 text-xs focus:outline-none focus:border-secondary transition-all"
                                  placeholder="Nome"
                                  type="text"
                                  name="personName"
                                  required
                                />
                                <input
                                  className="w-16 bg-surface-container-low border border-outline-variant rounded-lg p-1.5 text-xs focus:outline-none focus:border-secondary transition-all"
                                  placeholder="Qtd"
                                  type="number"
                                  step="0.01"
                                  name="quantity"
                                  required
                                />
                                <input
                                  className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg p-1.5 text-xs focus:outline-none focus:border-secondary transition-all"
                                  placeholder="Obs. (opcional)"
                                  type="text"
                                  name="observation"
                                />
                                <button
                                  type="submit"
                                  className="px-2 py-1 rounded-lg border border-outline text-primary text-xs font-bold hover:bg-surface-container-high transition-all whitespace-nowrap"
                                >
                                  Reservar
                                </button>
                              </form>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <AddItemForm action={boundAddItem} products={productRows} />
              </section>
            </div>

            <ProcessFinancials
              processId={id}
              etaEstimated={process.etaEstimated}
              financials={{
                currency: process.currency,
                incoterm: process.incoterm,
                internationalFreightValue: process.internationalFreightValue,
                insuranceValue: process.insuranceValue,
                exchangeRate: process.exchangeRate,
                exchangeRateDate: process.exchangeRateDate,
              }}
              invoices={invoices.map((inv) => ({
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                value: inv.value,
              }))}
            />

            <LandedCostBreakdown items={landedCost?.items ?? null} usedFallbackQuantity={landedCost?.usedFallbackQuantity ?? false} />

            <ProcessPayables
              payables={payables.map((p) => ({
                id: p.id,
                category: p.category,
                description: p.description,
                amount: p.amount,
                currency: p.currency,
                dueDate: p.dueDate,
                paidAt: p.paidAt,
              }))}
              createPayableAction={boundCreatePayable}
              canEdit={isAdmin}
            />

            <ProcessCompliance
              processId={id}
              customsChannel={process.customsChannel}
              lpcos={lpcos.map((lpco) => ({
                id: lpco.id,
                agency: lpco.agency,
                lpcoNumber: lpco.lpcoNumber,
                status: lpco.status,
                issuedAt: lpco.issuedAt,
                validUntil: lpco.validUntil,
                notes: lpco.notes,
              }))}
            />

            {(process.modal === "SEA_FCL" || process.modal === "SEA_LCL") && (
              <VesselTracker
                processId={id}
                vessel={{
                  vesselName: process.vesselName,
                  vesselImo: process.vesselImo,
                  vesselMmsi: process.vesselMmsi,
                  vesselLat: process.vesselLat,
                  vesselLon: process.vesselLon,
                  vesselSpeedKnots: process.vesselSpeedKnots,
                  vesselHeading: process.vesselHeading,
                  vesselDestination: process.vesselDestination,
                  vesselPositionUpdatedAt: process.vesselPositionUpdatedAt
                    ? process.vesselPositionUpdatedAt.toISOString()
                    : null,
                }}
              />
            )}

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
