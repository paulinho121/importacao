import Link from "next/link";
import AgentsTable from "@/components/AgentsTable";
import { db } from "@/db/client";
import { freightAgents, processes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function AgentesPage() {
  const rows = await db
    .select({
      id: freightAgents.id,
      name: freightAgents.name,
      contactName: freightAgents.contactName,
      email: freightAgents.email,
      phone: freightAgents.phone,
      processCount: sql<number>`count(${processes.id})`.mapWith(Number),
    })
    .from(freightAgents)
    .leftJoin(processes, eq(processes.agentId, freightAgents.id))
    .groupBy(freightAgents.id)
    .orderBy(freightAgents.name);

  return (
    <div className="p-6 md:p-10 max-w-[1440px] mx-auto w-full space-y-stack-lg">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-display-lg text-display-lg text-primary">Agentes de Carga</h2>
          <p className="text-on-surface-variant font-body-md text-body-md mt-1">
            Cadastro mestre de agentes de carga — processos referenciam este cadastro em vez
            de texto livre.
          </p>
        </div>
        <Link
          href="/agentes/novo"
          className="px-6 py-2.5 rounded-lg bg-secondary text-white font-label-md text-label-md hover:bg-secondary/90 transition-all shadow-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Novo Agente
        </Link>
      </div>

      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <AgentsTable rows={rows} />
      </section>
    </div>
  );
}
