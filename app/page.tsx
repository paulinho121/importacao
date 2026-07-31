import Link from "next/link";
import AppShell from "@/components/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { AlertCard } from "@/components/dashboard/AlertCard";
import { PipelineFunnel } from "@/components/dashboard/PipelineFunnel";
import { ProcessesTable } from "@/components/dashboard/ProcessesTable";
import { AreaChartCard } from "@/components/charts/AreaChartCard";
import { BarChartCard } from "@/components/charts/BarChartCard";
import { getDashboardMetrics } from "@/lib/dashboard-metrics";
import {
  PackageSearch,
  Ship,
  CheckCircle2,
  AlertTriangle,
  FileWarning,
  Boxes,
  ShieldCheck,
  DollarSign,
  Wallet,
} from "lucide-react";

export const dynamic = "force-dynamic";

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics();

  return (
    <AppShell title="Dashboard">
      <div className="space-y-6 pb-12">
        <PageHeader title="Dashboard" description="Visão geral das operações de importação" />

        <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:px-6">
          <KpiCard
            icon={<PackageSearch className="h-[18px] w-[18px]" />}
            label="Processos Ativos"
            value={String(metrics.kpis.processosAtivos.value)}
            trend={metrics.kpis.processosAtivos.trend}
            sparklineData={metrics.kpis.processosAtivos.sparkline}
            accent="var(--chart-1)"
          />
          <KpiCard
            icon={<Ship className="h-[18px] w-[18px]" />}
            label="Em Trânsito"
            value={String(metrics.kpis.emTransito.value)}
            trend={metrics.kpis.emTransito.trend}
            sparklineData={metrics.kpis.emTransito.sparkline}
            accent="var(--chart-2)"
          />
          <KpiCard
            icon={<CheckCircle2 className="h-[18px] w-[18px]" />}
            label="Processos Finalizados"
            value={String(metrics.kpis.finalizados.value)}
            trend={metrics.kpis.finalizados.trend}
            sparklineData={metrics.kpis.finalizados.sparkline}
            accent="var(--chart-2)"
          />
          <KpiCard
            icon={<AlertTriangle className="h-[18px] w-[18px]" />}
            label="Atrasados"
            value={String(metrics.kpis.atrasados.value)}
            trend={metrics.kpis.atrasados.trend}
            sparklineData={metrics.kpis.atrasados.sparkline}
            accent="var(--chart-5)"
          />
          <KpiCard
            icon={<FileWarning className="h-[18px] w-[18px]" />}
            label="Documentos Pendentes"
            value={String(metrics.kpis.documentosPendentes.value)}
            trend={metrics.kpis.documentosPendentes.trend}
            sparklineData={metrics.kpis.documentosPendentes.sparkline}
            accent="var(--chart-3)"
          />
          <KpiCard
            icon={<Boxes className="h-[18px] w-[18px]" />}
            label="Itens em Processo"
            value={String(metrics.kpis.itensEmProcesso.value)}
            trend={metrics.kpis.itensEmProcesso.trend}
            sparklineData={metrics.kpis.itensEmProcesso.sparkline}
            accent="var(--chart-4)"
          />
          <KpiCard
            icon={<DollarSign className="h-[18px] w-[18px]" />}
            label="Valor FOB Total"
            value={brlFormatter.format(metrics.kpis.valorFobTotal.value)}
            trend={metrics.kpis.valorFobTotal.trend}
            sparklineData={metrics.kpis.valorFobTotal.sparkline}
            accent="var(--chart-2)"
          />
          <KpiCard
            icon={<Wallet className="h-[18px] w-[18px]" />}
            label="Valor CIF Total"
            value={brlFormatter.format(metrics.kpis.valorCifTotal.value)}
            trend={metrics.kpis.valorCifTotal.trend}
            sparklineData={metrics.kpis.valorCifTotal.sparkline}
            accent="var(--chart-3)"
          />
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

        <div className="px-4 lg:px-6">
          <div className="rounded-card border border-border bg-card p-5">
            <SectionHeader
              title="Processos"
              description="Lista completa com filtros e ordenação"
              actions={
                <Link href="/processos" className="text-sm font-medium text-secondary hover:underline">
                  Ver todos
                </Link>
              }
            />
            <div className="mt-4">
              <ProcessesTable data={metrics.table} />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
