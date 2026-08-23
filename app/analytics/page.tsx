import AppShell from "@/components/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { BarChart3 } from "lucide-react";
import { SankeyChart } from "@/components/analytics/SankeyChart";
import { getSankeyData } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const sankeyData = await getSankeyData();
  const hasData = sankeyData.nodes.length > 0;

  return (
    <AppShell title="Analytics">
      <div className="space-y-6 pb-12">
        <PageHeader title="Analytics" description="Indicadores e relatórios avançados" />

        <div className="px-4 lg:px-6">
          {!hasData ? (
            <EmptyState
              icon={BarChart3}
              title="Sem dados ainda"
              description="Assim que houver processos cadastrados, o fluxo aparece aqui."
            />
          ) : (
            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 overflow-x-auto">
              <h3 className="font-headline-sm text-headline-sm text-primary mb-1">
                Fluxo: Fornecedor → Modal → Canal de Parametrização
              </h3>
              <p className="text-sm text-on-surface-variant mb-4">
                De onde vêm os processos e como se distribuem no desembaraço.
              </p>
              <SankeyChart data={sankeyData} />
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
