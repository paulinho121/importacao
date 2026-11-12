import { db } from "@/db/client";
import { suppliers, processes, freightAgents, purchaseOrders, purchaseOrderItems } from "@/db/schema";
import { and, eq, isNull, ne, notInArray, sql } from "drizzle-orm";
import { getSuppliersByProcess } from "@/lib/process-purchase-orders";
import NewProcessForm from "@/components/NewProcessForm";
import { BRANCHES, LANDING_LOCATIONS, locationLabel } from "@/lib/locations";
import ModalidadeTipoFields from "@/components/ModalidadeTipoFields";

export const dynamic = "force-dynamic";


async function suggestProcessNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(processes);
  return `PRC-${year}-${String(count + 1).padStart(3, "0")}`;
}

export default async function NovoProcessoPage() {
  const [agentRows, suggestedNumber, openProcessRows, orderRows] = await Promise.all([
    db.select({ id: freightAgents.id, name: freightAgents.name }).from(freightAgents).orderBy(freightAgents.name),
    suggestProcessNumber(),
    // processos em andamento: dá pra colocar mais pedidos neles
    db
      .select({ id: processes.id, processNumber: processes.processNumber })
      .from(processes)
      .where(notInArray(processes.status, ["CONCLUIDO", "ABANDONADO"]))
      .orderBy(processes.processNumber),
    // pedidos já criados que ainda não estão em nenhum processo
    db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        status: purchaseOrders.status,
        currency: purchaseOrders.currency,
        supplierId: suppliers.id,
        supplierName: suppliers.name,
        supplierLogoUrl: suppliers.logoUrl,
        itemCount: sql<number>`count(${purchaseOrderItems.id})`.mapWith(Number),
        total: sql<number>`coalesce(sum(${purchaseOrderItems.quantity} * ${purchaseOrderItems.unitPrice}), 0)`.mapWith(Number),
      })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .leftJoin(purchaseOrderItems, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
      .where(and(ne(purchaseOrders.status, "CANCELADO"), isNull(purchaseOrders.processId)))
      .groupBy(purchaseOrders.id, suppliers.id, suppliers.name, suppliers.logoUrl)
      .orderBy(suppliers.name, purchaseOrders.poNumber),
  ]);
  const suppliersByProcess = await getSuppliersByProcess(openProcessRows.map((p) => p.id));
  const processOptions = openProcessRows.map((p) => ({
    id: p.id,
    processNumber: p.processNumber,
    suppliers: suppliersByProcess.get(p.id) ?? [],
  }));

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto w-full">
      <div className="mb-8">
        <h2 className="font-display-lg text-display-lg text-primary">Novo Processo de Importação</h2>
        <p className="text-on-surface-variant font-body-md text-body-md mt-1">
          Cria o processo na etapa &ldquo;Cotação&rdquo;, pronto para avançar conforme progride.
        </p>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8">
        <NewProcessForm
          suggestedNumber={suggestedNumber}
          processes={processOptions}
          orders={orderRows}
        >
            <div className="sm:col-span-2">
              <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                Agente de Carga
              </label>
              <select
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all appearance-none"
                name="agentId"
                defaultValue=""
              >
                <option value="">Selecione o agente de carga</option>
                {agentRows.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {agentRows.length === 0 && (
                <p className="text-xs text-on-surface-variant mt-1">
                  Nenhum agente cadastrado — cadastre em /agentes/novo primeiro.
                </p>
              )}
            </div>
            <ModalidadeTipoFields
              defaultModal={null}
              defaultContainerType={null}
              selectClassName="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all appearance-none"
              labelClassName="block font-label-md text-label-md text-on-surface-variant mb-2"
            />
            <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="col-span-2 sm:col-span-4">
                <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                  Invoices
                </label>
              </div>
              {[1, 2, 3, 4].map((n) => (
                <input
                  key={n}
                  className="bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md font-mono-data focus:outline-none focus:border-secondary transition-all"
                  placeholder={`Invoice ${n}`}
                  type="text"
                  name={`invoice${n}`}
                />
              ))}
            </div>

            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                ETD (saída estimada)
              </label>
              <input
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
                type="date"
                name="etd"
              />
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                ETA (chegada estimada)
              </label>
              <input
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
                type="date"
                name="etaEstimated"
              />
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                Local de desembarque (porto/aeroporto)
              </label>
              <select
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all appearance-none"
                name="locationChoice"
                defaultValue=""
              >
                <option value="">Selecione (opcional)</option>
                {LANDING_LOCATIONS.map((loc) => (
                  <option key={loc.code} value={`${loc.code}|${loc.city}|${loc.state}`}>
                    {locationLabel(loc.code, loc.city, loc.state)}
                  </option>
                ))}
                <option value="OUTRO">Outro (descrever ao lado)</option>
              </select>
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                Filial de destino
              </label>
              <select
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all appearance-none"
                name="destinationBranch"
                defaultValue=""
              >
                <option value="">Selecione (opcional)</option>
                {BRANCHES.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                Local de desembarque (se não estiver na lista)
              </label>
              <input
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
                placeholder="ex: cidade/porto não listado"
                type="text"
                name="destination"
              />
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                Peso (kg)
              </label>
              <input
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
                type="number"
                step="0.01"
                name="weightKg"
              />
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                Volume (m³)
              </label>
              <input
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
                type="number"
                step="0.01"
                name="volumeM3"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                Observações
              </label>
              <textarea
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all resize-none"
                rows={4}
                name="notes"
              />
            </div>
        </NewProcessForm>
      </div>
    </div>
  );
}
