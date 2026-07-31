import AppShell from "@/components/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <AppShell title="Analytics">
      <div className="space-y-6 pb-12">
        <PageHeader title="Analytics" description="Indicadores e relatórios avançados" />
        <div className="px-4 lg:px-6">
          <EmptyState
            icon={BarChart3}
            title="Em construção"
            description="Os painéis de analytics serão disponibilizados em uma próxima fase."
          />
        </div>
      </div>
    </AppShell>
  );
}
