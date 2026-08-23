import Link from "next/link";
import AppShell from "@/components/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/supabase-server";
import { db } from "@/db/client";
import { processPayables, processes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PAYABLE_CATEGORY_LABEL, formatDate, diasRestantes, type PayableCategory } from "@/lib/status";
import { markPayableAsPaid } from "./actions";

export const dynamic = "force-dynamic";

type FilterKey = "aberto" | "vencida" | "pago" | "todas";

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status } = await searchParams;
  const filter: FilterKey = status === "vencida" || status === "pago" || status === "todas" ? status : "aberto";

  const rows = await db
    .select({
      id: processPayables.id,
      category: processPayables.category,
      description: processPayables.description,
      amount: processPayables.amount,
      currency: processPayables.currency,
      dueDate: processPayables.dueDate,
      paidAt: processPayables.paidAt,
      processId: processPayables.processId,
      processNumber: processes.processNumber,
    })
    .from(processPayables)
    .innerJoin(processes, eq(processPayables.processId, processes.id))
    .orderBy(processPayables.dueDate);

  const withStatus = rows.map((r) => {
    const dias = r.paidAt ? null : diasRestantes(r.dueDate);
    const vencida = dias !== null && dias < 0;
    return { ...r, vencida };
  });

  const totalEmAberto = withStatus.filter((r) => !r.paidAt).reduce((sum, r) => sum + Number(r.amount), 0);

  const filtered = withStatus.filter((r) => {
    if (filter === "todas") return true;
    if (filter === "pago") return Boolean(r.paidAt);
    if (filter === "vencida") return !r.paidAt && r.vencida;
    return !r.paidAt; // aberto (inclui vencidas)
  });

  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "aberto", label: "Em Aberto" },
    { key: "vencida", label: "Vencidas" },
    { key: "pago", label: "Pagas" },
    { key: "todas", label: "Todas" },
  ];

  return (
    <AppShell title="Financeiro">
      <div className="p-6 md:p-10 max-w-[1200px] mx-auto w-full space-y-stack-lg">
        <div className="flex justify-between items-end flex-wrap gap-4">
          <PageHeader title="Financeiro" description="Contas a pagar de todos os processos" />
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl px-5 py-3">
            <p className="text-xs text-on-surface-variant">Total em aberto</p>
            <p className="font-bold text-primary text-xl">{brl.format(totalEmAberto)}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/financeiro?status=${f.key}`}
              className={`px-4 py-2 rounded-lg font-label-md text-label-md transition-all ${
                filter === f.key
                  ? "bg-secondary text-white"
                  : "bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nenhuma conta a pagar ainda"
            description="Adicione contas a pagar direto na tela de detalhe de um processo."
          />
        ) : (
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">PROCESSO</th>
                    <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">CATEGORIA</th>
                    <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">DESCRIÇÃO</th>
                    <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">VALOR</th>
                    <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">VENCIMENTO</th>
                    <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">STATUS</th>
                    <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant text-right">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant font-body-sm text-body-sm">
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-6 text-on-surface-variant text-center">
                        Nenhuma conta nesse filtro.
                      </td>
                    </tr>
                  )}
                  {filtered.map((r) => {
                    const boundMarkPaid = markPayableAsPaid.bind(null, r.id);
                    return (
                      <tr key={r.id} className="hover:bg-surface-container-high transition-colors">
                        <td className="px-6 py-3 font-mono-data">
                          <Link href={`/processos/${r.processId}`} className="text-secondary hover:underline">
                            {r.processNumber}
                          </Link>
                        </td>
                        <td className="px-6 py-3">{PAYABLE_CATEGORY_LABEL[r.category as PayableCategory]}</td>
                        <td className="px-6 py-3">{r.description}</td>
                        <td className="px-6 py-3 font-mono-data">
                          {Number(r.amount).toFixed(2)} {r.currency}
                        </td>
                        <td className="px-6 py-3">{formatDate(r.dueDate)}</td>
                        <td className="px-6 py-3">
                          {r.paidAt ? (
                            <span className="px-2 py-1 rounded-full font-label-md text-label-md bg-tertiary-fixed text-on-tertiary-fixed-variant">
                              Pago {formatDate(r.paidAt)}
                            </span>
                          ) : r.vencida ? (
                            <span className="px-2 py-1 rounded-full font-label-md text-label-md bg-error-container text-on-error-container">
                              Vencida
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full font-label-md text-label-md bg-surface-container-high text-on-surface-variant">
                              Em aberto
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {!r.paidAt && (
                            <form action={boundMarkPaid}>
                              <button
                                type="submit"
                                className="px-3 py-1.5 rounded-lg text-secondary hover:bg-secondary/10 transition-colors font-label-md text-label-md"
                              >
                                Marcar como paga
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
