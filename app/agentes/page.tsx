import Link from "next/link";
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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">NOME</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">CONTATO</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">TELEFONE</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">PROCESSOS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant font-body-sm text-body-sm">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-6 text-on-surface-variant text-center">
                    Nenhum agente de carga cadastrado ainda.
                  </td>
                </tr>
              )}
              {rows.map((a) => (
                <tr key={a.id} className="hover:bg-surface-container-high transition-colors">
                  <td className="px-6 py-3 font-medium">
                    <Link href={`/agentes/${a.id}`} className="text-secondary hover:underline">
                      {a.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3">{a.contactName ?? a.email ?? "—"}</td>
                  <td className="px-6 py-3">{a.phone ?? "—"}</td>
                  <td className="px-6 py-3 font-mono-data">{a.processCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
