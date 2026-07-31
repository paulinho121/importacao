import AppShell from "@/components/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Settings } from "lucide-react";

export default function ConfiguracoesPage() {
  return (
    <AppShell title="Configurações">
      <div className="space-y-6 pb-12">
        <PageHeader title="Configurações" description="Preferências do sistema e da conta" />
        <div className="px-4 lg:px-6">
          <EmptyState
            icon={Settings}
            title="Em construção"
            description="As configurações do sistema serão disponibilizadas em uma próxima fase."
          />
        </div>
      </div>
    </AppShell>
  );
}
