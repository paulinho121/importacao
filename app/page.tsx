import Link from "next/link";
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
    <div className="space-y-6 pb-12">
      <PageHeader title="Dashboard" description="Visão geral das operações de importação" />

      <div className="grid grid-cols-1 gap-3 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
        <KpiCard
          icon={<PackageSearch className="h-4 w-4" />}
          label="Processos Ativos"
          value={String(metrics.kpis.processosAtivos.value)}
          trend={metrics.kpis.processosAtivos.trend}
          sparklineData={metrics.kpis.processosAtivos.sparkline}
          accent="var(--chart-1)"
          href="/processos?ativos=1"
        />
        <KpiCard
          icon={<Ship className="h-4 w-4" />}
          label="Em Trânsito"
          value={String(metrics.kpis.emTransito.value)}
          trend={metrics.kpis.emTransito.trend}
          sparklineData={metrics.kpis.emTransito.sparkline}
          accent="var(--chart-1)"
          href="/processos?status=EM_TRANSITO"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Processos Finalizados"
          value={String(metrics.kpis.finalizados.value)}
          trend={metrics.kpis.finalizados.trend}
          sparklineData={metrics.kpis.finalizados.sparkline}
          accent="var(--chart-2)"
          href="/processos?status=CONCLUIDO"
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Atrasados"
          value={String(metrics.kpis.atrasados.value)}
          trend={metrics.kpis.atrasados.trend}
          sparklineData={metrics.kpis.atrasados.sparkline}
          accent="var(--chart-5)"
          href="/processos?status=ATRASADO"
        />
        <KpiCard
          icon={<FileWarning className="h-4 w-4" />}
          label="Documentos Pendentes"
          value={String(metrics.kpis.documentosPendentes.value)}
          trend={metrics.kpis.documentosPendentes.trend}
          sparklineData={metrics.kpis.documentosPendentes.sparkline}
          accent="var(--chart-3)"
          href="/processos?docsPendentes=1"
        />
        <KpiCard
          icon={<Boxes className="h-4 w-4" />}
          label="Itens em Processo"
          value={String(metrics.kpis.itensEmProcesso.value)}
          trend={metrics.kpis.itensEmProcesso.trend}
          sparklineData={metrics.kpis.itensEmProcesso.sparkline}
          accent="var(--chart-1)"
          href="/processos?ativos=1"
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Valor FOB Total"
          value={brlFormatter.format(metrics.kpis.valorFobTotal.value)}
          trend={metrics.kpis.valorFobTotal.trend}
          sparklineData={metrics.kpis.valorFobTotal.sparkline}
          accent="var(--chart-1)"
          href="/processos?ativos=1"
        />
        <KpiCard
          icon={<Wallet className="h-4 w-4" />}
          label="Valor CIF Total"
          value={brlFormatter.format(metrics.kpis.valorCifTotal.value)}
          trend={metrics.kpis.valorCifTotal.trend}
          sparklineData={metrics.kpis.valorCifTotal.sparkline}
          accent="var(--chart-1)"
          href="/processos?ativos=1"
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
  );
}
