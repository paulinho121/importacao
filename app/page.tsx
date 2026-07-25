import Link from "next/link";
import AppShell from "@/components/AppShell";
import { db } from "@/db/client";
import { processes, suppliers } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import {
  STATUS_BADGE_CLASS,
  STATUS_LABEL,
  diasRestantes,
  formatDate,
  type ProcessStatus,
} from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const rows = await db
    .select({
      id: processes.id,
      processNumber: processes.processNumber,
      status: processes.status,
      modal: processes.modal,
      etaEstimated: processes.etaEstimated,
      supplierName: suppliers.name,
    })
    .from(processes)
    .innerJoin(suppliers, eq(processes.supplierId, suppliers.id))
    .orderBy(desc(processes.createdAt));

  const ativos = rows.filter((p) => p.status !== "CONCLUIDO");
  const emTransito = rows.filter((p) => p.status === "EM_TRANSITO");
  const atrasados = rows.filter((p) => p.status === "ATRASADO");

  const modalCounts = ativos.reduce<Record<string, number>>((acc, p) => {
    const key = p.modal ?? "NÃO INFORMADO";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const maxModalCount = Math.max(1, ...Object.values(modalCounts));

  const alertas = rows
    .filter(
      (p) =>
        p.status !== "CONCLUIDO" &&
        (p.status === "ATRASADO" || (diasRestantes(p.etaEstimated) ?? 99) <= 3),
    )
    .slice(0, 5);

  return (
    <AppShell title="Executive Dashboard">
      <div className="p-gutter lg:px-stack-lg lg:pt-stack-lg pb-stack-lg space-y-stack-lg">
        <div>
          <h1 className="font-display-lg text-display-lg text-primary">
            Executive Dashboard
          </h1>
          <p className="text-on-surface-variant font-body-md text-body-md">
            Visão geral das operações de importação
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard label="PROCESSOS ATIVOS" value={ativos.length} />
          <KpiCard label="EM TRÂNSITO" value={emTransito.length} />
          <KpiCard label="TOTAL DE PROCESSOS" value={rows.length} />
          <KpiCard
            label="PROCESSOS ATRASADOS"
            value={atrasados.length}
            critical={atrasados.length > 0}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <h3 className="font-headline-sm text-headline-sm text-primary mb-4">
              Processos Ativos por Modal
            </h3>
            <div className="space-y-3">
              {Object.entries(modalCounts).length === 0 && (
                <p className="text-on-surface-variant font-body-sm text-body-sm">
                  Nenhum processo ativo.
                </p>
              )}
              {Object.entries(modalCounts).map(([modal, n]) => (
                <div key={modal} className="space-y-1">
                  <div className="flex justify-between font-label-md text-label-md">
                    <span className="text-on-surface-variant">{modal}</span>
                    <span className="text-primary font-bold">{n}</span>
                  </div>
                  <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="bg-secondary h-full rounded-full"
                      style={{ width: `${(n / maxModalCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4 text-error">
              <span className="material-symbols-outlined">warning</span>
              <h3 className="font-headline-sm text-headline-sm text-primary">
                Alertas Prioritários
              </h3>
            </div>
            <div className="space-y-3">
              {alertas.length === 0 && (
                <p className="text-on-surface-variant font-body-sm text-body-sm">
                  Nenhum alerta no momento.
                </p>
              )}
              {alertas.map((p) => {
                const dias = diasRestantes(p.etaEstimated);
                return (
                  <Link
                    key={p.id}
                    href={`/processos/${p.id}`}
                    className="flex items-start gap-3 p-3 bg-error-container/20 rounded-lg border border-error-container/50 hover:bg-error-container/30 transition-colors"
                  >
                    <span className="material-symbols-outlined text-error mt-0.5">
                      assignment_late
                    </span>
                    <div>
                      <p className="font-bold text-sm text-primary">
                        {p.processNumber} — {p.supplierName}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {STATUS_LABEL[p.status as ProcessStatus]} · ETA{" "}
                        {formatDate(p.etaEstimated)}
                        {dias !== null && dias < 0
                          ? ` · ${Math.abs(dias)} dia(s) atrasado`
                          : dias !== null
                            ? ` · faltam ${dias} dia(s)`
                            : ""}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>

        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          <div className="px-gutter py-4 bg-surface-container flex items-center justify-between">
            <h3 className="font-label-md text-label-md text-primary uppercase tracking-wider">
              Processos Recentes
            </h3>
            <Link href="/processos" className="text-secondary font-bold text-xs">
              VER TODOS
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">PROCESSO</th>
                  <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">FORNECEDOR</th>
                  <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">MODAL</th>
                  <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">ETA</th>
                  <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant font-body-sm text-body-sm">
                {rows.slice(0, 8).map((p) => (
                  <tr key={p.id} className="hover:bg-surface-container-high transition-colors">
                    <td className="px-6 py-3 font-mono-data">
                      <Link href={`/processos/${p.id}`} className="hover:underline text-secondary">
                        {p.processNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-3 font-medium">{p.supplierName}</td>
                    <td className="px-6 py-3">{p.modal ?? "—"}</td>
                    <td className="px-6 py-3 font-mono-data">{formatDate(p.etaEstimated)}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`px-3 py-1 rounded-full font-label-md text-label-md ${STATUS_BADGE_CLASS[p.status as ProcessStatus]}`}
                      >
                        {STATUS_LABEL[p.status as ProcessStatus]}
                      </span>
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

function KpiCard({
  label,
  value,
  critical,
}: {
  label: string;
  value: number;
  critical?: boolean;
}) {
  return (
    <div
      className={`border p-5 rounded-xl flex flex-col gap-2 relative overflow-hidden ${
        critical
          ? "border-error bg-error-container/10"
          : "border-outline-variant bg-surface-container-lowest"
      }`}
    >
      <span className="font-label-md text-label-md text-outline">{label}</span>
      <span
        className={`font-display-lg text-display-lg ${critical ? "text-error" : "text-primary"}`}
      >
        {value}
      </span>
    </div>
  );
}
