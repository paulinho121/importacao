import AppShell from "@/components/AppShell";
import AgentForm from "@/components/AgentForm";
import { createAgent } from "@/app/agentes/actions";

export const dynamic = "force-dynamic";

export default function NovoAgentePage() {
  return (
    <AppShell title="Novo Agente de Carga">
      <div className="p-6 md:p-10 max-w-3xl mx-auto w-full">
        <div className="mb-8">
          <h2 className="font-display-lg text-display-lg text-primary">
            Cadastro de Agente de Carga
          </h2>
          <p className="text-on-surface-variant font-body-md text-body-md mt-1">
            Adicionar agente de carga (freight forwarder) ao cadastro.
          </p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8">
          <AgentForm action={createAgent} submitLabel="Cadastrar Agente" />
        </div>
      </div>
    </AppShell>
  );
}
