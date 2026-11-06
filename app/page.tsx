import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { AlertCard } from "@/components/dashboard/AlertCard";
import { PipelineFunnel } from "@/components/dashboard/PipelineFunnel";
import { ProcessesTable } from "@/components/dashboard/ProcessesTable";
import { AreaChartCard } from "@/components/charts/AreaChartCard";
import { BarChartCard } from "@/components/charts/BarChartCard";
import { getDashboardMetrics } from "@/lib/dashboard-metrics";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics();

  return (
    <div className="space-y-6 pb-12">
      <div className="px-4 pt-6 lg:px-6">
        <DashboardHero />
      </div>

      <div className="px-4 lg:px-6">
        <ProcessesTable data={metrics.table} />
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:px-6">
        <div className="lg:col-span-2">
          <AreaChartCard
            title="Importações por Mês"
            description="Processos por mês (ETD)"
            data={metrics.importsByMonth}
          />
        </div>

        <div className="rounded-card border border-border bg-card p-5">
          <SectionHeader title="Alertas Prioritários" />
          <div className="mt-4 space-y-2">
            {metrics.alerts.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="Nenhum alerta no momento" />
            ) : (
              metrics.alerts.map((alert) => <AlertCard key={alert.id} {...alert} />)
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:px-6">
        <div className="lg:col-span-1">
          <BarChartCard
            title="Processos por Destino"
            description="Distribuição por cidade/estado de destino"
            data={metrics.byDestination}
            layout="vertical"
            color="var(--chart-1)"
          />
        </div>
        <div className="lg:col-span-2">
          <PipelineFunnel stages={metrics.pipeline} />
        </div>
      </div>

      {metrics.ncmDivergences.length > 0 && (
        <div className="grid grid-cols-1 gap-4 px-4 lg:px-6">
          <div className="rounded-card border border-border bg-card p-5">
            <SectionHeader
              title="NCM Divergente do Decex"
              description="Produtos onde o NCM cadastrado difere da lista oficial de apuração de produção nacional"
            />
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {metrics.ncmDivergences.map((p) => (
                <AlertCard
                  key={p.id}
                  level="warning"
                  title={p.sku}
                  description={`NCM: ${p.ncm ?? "—"} → sugerido: ${p.ncmOfficialSuggested ?? "—"}`}
                  href={`/produtos/${p.id}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {metrics.byCustomsChannel.length > 0 && (
        <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:px-6">
          <div className="lg:col-span-1">
            <BarChartCard
              title="Canal de Parametrização"
              description="Processos ativos por canal (dado manual, pós-registro)"
              data={metrics.byCustomsChannel}
              layout="vertical"
              color="var(--chart-3)"
            />
          </div>
        </div>
      )}
    </div>
  );
}
