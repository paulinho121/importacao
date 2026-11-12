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
    <>
      {/* Mobile cards view */}
      <div className="grid gap-3 p-4 md:hidden">
        {rows.length === 0 ? (
          <p className="py-6 text-on-surface-variant text-center text-sm">
            Nenhum agente de carga cadastrado ainda.
          </p>
        ) : (
          rows.map((a) => {
            const editing = editingId === a.id;
            const formId = `agent-m-${a.id}`;
            return (
              <div
                key={a.id}
                className="rounded-xl border border-outline-variant bg-surface-container-low/40 p-4 space-y-3"
              >
                {editing ? (
                  <form action={updateAgentInline.bind(null, a.id)} className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant mb-1 block">Nome</label>
                      <input name="name" defaultValue={a.name} required className={INPUT} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant mb-1 block">Contato</label>
                      <input name="contactName" defaultValue={a.contactName ?? ""} placeholder="Pessoa de contato" className={INPUT} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant mb-1 block">E-mail</label>
                      <input name="email" type="email" defaultValue={a.email ?? ""} placeholder="contato@agente.com" className={INPUT} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-on-surface-variant mb-1 block">Telefone</label>
                      <input name="phone" type="tel" defaultValue={a.phone ?? ""} placeholder="+55 00 00000-0000" className={INPUT} />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/40">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-xs font-bold text-on-surface-variant px-3 py-1.5 hover:underline"
                      >
                        Cancelar
                      </button>
                      <SubmitButton className="rounded-lg bg-secondary px-4 py-1.5 text-xs font-bold text-white hover:opacity-90">
                        Salvar
                      </SubmitButton>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/agentes/${a.id}`}
                          className="font-semibold text-primary hover:text-secondary hover:underline block truncate text-base"
                        >
                          {a.name}
                        </Link>
                        {a.contactName && <p className="text-xs text-on-surface-variant mt-0.5">{a.contactName}</p>}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-md font-mono-data bg-surface-container-high text-on-surface-variant">
                        {a.processCount} {a.processCount === 1 ? "proc." : "procs."}
                      </span>
                    </div>

                    {(a.email || a.phone) && (
                      <div className="space-y-1 text-xs pt-2 border-t border-outline-variant/40 text-on-surface-variant">
                        {a.email && <p className="truncate">📧 {a.email}</p>}
                        {a.phone && <p className="truncate">📞 {a.phone}</p>}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant/40">
                      <button
                        type="button"
                        onClick={() => setEditingId(a.id)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-secondary hover:underline"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        Editar
                      </button>
                      <Link
                        href={`/agentes/${a.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-on-surface-variant hover:text-secondary hover:underline"
                      >
                        Ver Agente
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </Link>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto">
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
    </>
  );
}
