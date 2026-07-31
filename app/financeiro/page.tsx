import AppShell from "@/components/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Wallet } from "lucide-react";

export default function FinanceiroPage() {
  return (
    <AppShell title="Financeiro">
      <div className="space-y-6 pb-12">
        <PageHeader title="Financeiro" description="Custos e valores das operações de importação" />
        <div className="px-4 lg:px-6">
          <EmptyState
            icon={Wallet}
            title="Em construção"
            description="O módulo financeiro será disponibilizado em uma próxima fase."
          />
        </div>
      </div>
    </AppShell>
  );
}
