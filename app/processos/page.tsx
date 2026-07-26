import Link from "next/link";
import AppShell from "@/components/AppShell";
import SupplierLogo from "@/components/SupplierLogo";
import { db } from "@/db/client";
import { processes, suppliers, processItems } from "@/db/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  STATUS_BADGE_CLASS,
  STATUS_ICON,
  STATUS_LABEL,
  formatDate,
  type ProcessStatus,
} from "@/lib/status";

export const dynamic = "force-dynamic";

const MODAL_FILTERS = [
  { value: "", label: "Todos", icon: "filter_list" },
  { value: "AIR", label: "Aéreo", icon: "flight" },
  { value: "SEA_FCL", label: "Marítimo FCL", icon: "directions_boat" },
  { value: "SEA_LCL", label: "Marítimo LCL", icon: "directions_boat" },
  { value: "COURIER", label: "Courier", icon: "local_shipping" },
  { value: "ROAD", label: "Rodoviário", icon: "local_shipping" },
] as const;

const MODAL_ICON: Record<string, string> = {
  AIR: "flight",
  SEA_FCL: "directions_boat",
  SEA_LCL: "directions_boat",
  COURIER: "local_shipping",
  ROAD: "local_shipping",
};

export default async function ProcessosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; modal?: string }>;
}) {
  const { q = "", modal = "" } = await searchParams;

  const conditions = [];
  if (modal) {
    conditions.push(eq(processes.modal, modal as (typeof processes.modal.enumValues)[number]));
  }
  if (q) {
    conditions.push(
      or(
        ilike(processes.processNumber, `%${q}%`),
        ilike(processes.invoiceNumber, `%${q}%`),
        ilike(suppliers.name, `%${q}%`),
      ),
    );
  }

  const rows = await db
    .select({
      id: processes.id,
      processNumber: processes.processNumber,
      status: processes.status,
      modal: processes.modal,
      etd: processes.etd,
      etaEstimated: processes.etaEstimated,
      currentStep: processes.currentStep,
      supplierName: suppliers.name,
      supplierLogoUrl: suppliers.logoUrl,
      itemCount: sql<number>`count(${processItems.id})`.mapWith(Number),
      firstSku: sql<string | null>`min(${processItems.sku})`,
    })
    .from(processes)
    .innerJoin(suppliers, eq(processes.supplierId, suppliers.id))
    .leftJoin(processItems, eq(processItems.processId, processes.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(processes.id, suppliers.name, suppliers.logoUrl)
    .orderBy(desc(processes.createdAt));

  return (
    <AppShell title="Processos de Importação">
      <div className="p-gutter lg:px-stack-lg lg:pt-stack-lg flex justify-end">
        <Link
          href="/processos/novo"
          className="px-6 py-2.5 rounded-lg bg-secondary text-white font-label-md text-label-md hover:bg-secondary/90 transition-all shadow-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Novo Processo
        </Link>
      </div>
      <div className="p-gutter lg:px-stack-lg">
        <form className="flex flex-col md:flex-row gap-4 items-end md:items-center" action="/processos">
          <div className="relative flex-1 w-full">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
              search
            </span>
            <input
              className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:border-secondary transition-colors font-body-md text-body-md"
              placeholder="Buscar por processo, fornecedor ou invoice..."
              type="text"
              name="q"
              defaultValue={q}
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {MODAL_FILTERS.map((f) => (
              <Link
                key={f.value}
                href={{ pathname: "/processos", query: { ...(q ? { q } : {}), ...(f.value ? { modal: f.value } : {}) } }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-label-md text-label-md whitespace-nowrap transition-colors ${
                  modal === f.value
                    ? "bg-secondary text-on-secondary"
                    : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{f.icon}</span>
                {f.label}
              </Link>
            ))}
          </div>
        </form>
      </div>

      <div className="p-gutter lg:px-stack-lg pb-32">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {rows.length === 0 && (
            <p className="text-on-surface-variant font-body-md text-body-md col-span-full">
              Nenhum processo encontrado.
            </p>
          )}
          {rows.map((p) => {
            const progress = Math.round((p.currentStep / 7) * 100);
            const badgeClass = STATUS_BADGE_CLASS[p.status as ProcessStatus];
            return (
              <Link
                key={p.id}
                href={`/processos/${p.id}`}
                className="group bg-surface-container-lowest border border-outline-variant p-5 rounded-xl hover:shadow-lg transition-all cursor-pointer flex flex-col gap-4 relative overflow-hidden"
              >
                <div
                  className={`absolute top-0 left-0 w-1 h-full ${
                    p.status === "ATRASADO" ? "bg-error" : "bg-secondary"
                  }`}
                />
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-mono-data text-mono-data text-outline mb-1">
                      {p.processNumber}
                    </h3>
                    <div className="flex items-center gap-2">
                      <SupplierLogo logoUrl={p.supplierLogoUrl} name={p.supplierName} size={24} />
                      <p className="font-headline-sm text-headline-sm text-primary">
                        {p.supplierName}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full font-label-md text-label-md flex items-center gap-1 ${badgeClass}`}>
                    <span className="material-symbols-outlined text-[14px]">
                      {STATUS_ICON[p.status as ProcessStatus]}
                    </span>
                    {STATUS_LABEL[p.status as ProcessStatus]}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 my-2">
                  <div>
                    <span className="font-label-md text-label-md text-outline block">ETD</span>
                    <span className="font-body-md text-body-md text-on-surface font-bold">
                      {formatDate(p.etd)}
                    </span>
                  </div>
                  <div>
                    <span className="font-label-md text-label-md text-outline block">ETA</span>
                    <span className="font-body-md text-body-md text-on-surface font-bold">
                      {formatDate(p.etaEstimated)}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center font-label-md text-label-md">
                    <span className="text-outline">Progresso do fluxo</span>
                    <span className="text-secondary font-bold">{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="bg-secondary h-full rounded-full transition-all duration-1000"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2 border-t border-outline-variant">
                  <span className="material-symbols-outlined text-outline">
                    {MODAL_ICON[p.modal ?? ""] ?? "help"}
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {p.modal ?? "Modal não informado"} · {p.itemCount}{" "}
                    {p.itemCount === 1 ? "item" : "itens"}
                    {p.firstSku ? ` · SKU: ${p.firstSku}` : ""}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
