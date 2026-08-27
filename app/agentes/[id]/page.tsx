import { notFound } from "next/navigation";
import AgentForm from "@/components/AgentForm";
import { updateAgent } from "@/app/agentes/actions";
import { db } from "@/db/client";
import { freightAgents } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function EditAgentePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [agent] = await db.select().from(freightAgents).where(eq(freightAgents.id, id));

  if (!agent) notFound();

  const boundUpdate = updateAgent.bind(null, id);

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto w-full">
      <div className="mb-8">
        <h2 className="font-display-lg text-display-lg text-primary">{agent.name}</h2>
        <p className="text-on-surface-variant font-body-md text-body-md mt-1">
          Editar dados do agente de carga.
        </p>
      </div>
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8">
        <AgentForm action={boundUpdate} defaultValues={agent} submitLabel="Salvar Alterações" />
      </div>
    </div>
  );
}
