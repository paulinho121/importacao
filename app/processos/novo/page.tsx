import AppShell from "@/components/AppShell";
import { createProcess } from "@/app/processos/actions";
import { db } from "@/db/client";
import { suppliers, processes, freightAgents } from "@/db/schema";
import { sql } from "drizzle-orm";
import { LOCATIONS, locationLabel } from "@/lib/locations";

export const dynamic = "force-dynamic";

const MODAIS = [
  { value: "", label: "Selecione o modal" },
  { value: "AIR", label: "Aéreo" },
  { value: "SEA_FCL", label: "Marítimo FCL" },
  { value: "SEA_LCL", label: "Marítimo LCL" },
  { value: "SEA_BREAK_BULK", label: "Marítimo Break Bulk" },
  { value: "SEA_RORO", label: "Marítimo RORO" },
  { value: "COURIER", label: "Courier" },
  { value: "ROAD", label: "Rodoviário" },
];

async function suggestProcessNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(processes);
  return `PRC-${year}-${String(count + 1).padStart(3, "0")}`;
}

export default async function NovoProcessoPage() {
  const [supplierRows, agentRows, suggestedNumber] = await Promise.all([
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).orderBy(suppliers.name),
    db.select({ id: freightAgents.id, name: freightAgents.name }).from(freightAgents).orderBy(freightAgents.name),
    suggestProcessNumber(),
  ]);

  return (
    <AppShell title="Novo Processo">
      <div className="p-6 md:p-10 max-w-3xl mx-auto w-full">
        <div className="mb-8">
          <h2 className="font-display-lg text-display-lg text-primary">Novo Processo de Importação</h2>
          <p className="text-on-surface-variant font-body-md text-body-md mt-1">
            Cria o processo na etapa &ldquo;Cotação&rdquo;, pronto para avançar conforme progride.
          </p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8">
          <form action={createProcess} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                  Número do Processo
                </label>
                <input
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md font-mono-data focus:outline-none focus:border-secondary transition-all"
                  type="text"
                  name="processNumber"
                  defaultValue={suggestedNumber}
                  required
                />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                  Fornecedor
                </label>
                <select
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all appearance-none"
                  name="supplierId"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecione o fornecedor
                  </option>
                  {supplierRows.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {supplierRows.length === 0 && (
                  <p className="text-xs text-error mt-1">
                    Nenhum fornecedor cadastrado — cadastre um em /fornecedores/novo primeiro.
                  </p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                  Referência Externa
                </label>
                <input
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
                  placeholder="ex: referência do fornecedor/agente, se houver"
                  type="text"
                  name="externalReference"
                />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                  Modal
                </label>
                <select
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all appearance-none"
                  name="modal"
                  defaultValue=""
                >
                  {MODAIS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                  Agente de Carga
                </label>
                <select
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all appearance-none"
                  name="agentId"
                  defaultValue=""
                >
                  <option value="">Nenhum</option>
                  {agentRows.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

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
                  Destino (porto/aeroporto conhecido)
                </label>
                <select
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all appearance-none"
                  name="locationChoice"
                  defaultValue=""
                >
                  <option value="">Selecione (opcional)</option>
                  {LOCATIONS.map((loc) => (
                    <option key={loc.code} value={`${loc.code}|${loc.city}|${loc.state}`}>
                      {locationLabel(loc.code, loc.city, loc.state)}
                    </option>
                  ))}
                  <option value="OUTRO">Outro (descrever ao lado)</option>
                </select>
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
                  Destino (se não estiver na lista)
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
            </div>

            <div className="flex justify-end gap-4 pt-2">
              <button
                type="submit"
                className="px-8 py-3 rounded-lg bg-secondary text-white font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all"
              >
                Criar Processo
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
