"use client";

import { useState } from "react";
import Link from "next/link";
import { updateAgentInline } from "@/app/agentes/actions";

import SubmitButton from "@/components/SubmitButton";
export type AgentRow = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  processCount: number;
};

const INPUT =
  "w-full rounded-lg border border-outline-variant bg-surface-container-low px-2.5 py-1.5 text-body-sm font-body-sm focus:border-secondary focus:outline-none transition-all";
const TH = "px-6 py-3 font-label-md text-label-md text-on-surface-variant";

// Lista de agentes de carga com edição na própria linha: "Editar" transforma
// nome, contato, e-mail e telefone em campos; "Salvar" grava e volta.
export default function AgentsTable({ rows }: { rows: AgentRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-surface-container-low border-b border-outline-variant">
            <th className={TH}>NOME</th>
            <th className={TH}>CONTATO</th>
            <th className={TH}>E-MAIL</th>
            <th className={TH}>TELEFONE</th>
            <th className={TH}>PROCESSOS</th>
            <th className={`${TH} text-right`}>AÇÕES</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant font-body-sm text-body-sm">
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-6 text-on-surface-variant text-center">
                Nenhum agente de carga cadastrado ainda.
              </td>
            </tr>
          )}
          {rows.map((a) => {
            const editing = editingId === a.id;
            const formId = `agent-${a.id}`;
            return (
              <tr key={a.id} className={editing ? "bg-surface-container-low" : "hover:bg-surface-container-high transition-colors"}>
                {editing ? (
                  <>
                    <td className="px-4 py-2">
                      <input form={formId} name="name" defaultValue={a.name} required aria-label="Nome" className={INPUT} />
                    </td>
                    <td className="px-4 py-2">
                      <input form={formId} name="contactName" defaultValue={a.contactName ?? ""} placeholder="Pessoa de contato" aria-label="Contato" className={INPUT} />
                    </td>
                    <td className="px-4 py-2">
                      <input form={formId} name="email" type="email" defaultValue={a.email ?? ""} placeholder="contato@agente.com" aria-label="E-mail" className={INPUT} />
                    </td>
                    <td className="px-4 py-2">
                      <input form={formId} name="phone" type="tel" defaultValue={a.phone ?? ""} placeholder="+55 00 00000-0000" aria-label="Telefone" className={INPUT} />
                    </td>
                    <td className="px-6 py-3 font-mono-data">{a.processCount}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-right">
                      <form id={formId} action={updateAgentInline.bind(null, a.id)} className="inline">
                        <SubmitButton className="mr-3 rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold text-white hover:opacity-90">
                          Salvar
                        </SubmitButton>
                      </form>
                      <button type="button" onClick={() => setEditingId(null)} className="text-xs font-bold text-on-surface-variant hover:underline">
                        Cancelar
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-6 py-3 font-medium">
                      <Link href={`/agentes/${a.id}`} className="text-secondary hover:underline" title="Abrir página do agente (inclui observações)">
                        {a.name}
                      </Link>
                    </td>
                    <td className="px-6 py-3">{a.contactName ?? "—"}</td>
                    <td className="px-6 py-3">{a.email ?? "—"}</td>
                    <td className="px-6 py-3">{a.phone ?? "—"}</td>
                    <td className="px-6 py-3 font-mono-data">{a.processCount}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingId(a.id)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-secondary hover:underline"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        Editar
                      </button>
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
