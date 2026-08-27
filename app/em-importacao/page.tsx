import Link from "next/link";
import { db } from "@/db/client";
import { externalImportItems } from "@/db/schema";
import { and, ilike, inArray, notInArray, or, asc, sql } from "drizzle-orm";
import DeleteExternalImportItemButton from "@/components/DeleteExternalImportItemButton";
import { deleteExternalImportItem } from "@/app/em-importacao/actions";
import {
  EXTERNAL_IMPORT_ITEM_STATUS_LABEL,
  EXTERNAL_IMPORT_ITEM_STATUS_BADGE_CLASS,
  EXTERNAL_IMPORT_ITEM_INACTIVE_STATUSES,
  formatDate,
  type ExternalImportItemStatus,
} from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function EmImportacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; todos?: string }>;
}) {
  const { q = "", todos = "" } = await searchParams;
  const showAll = todos === "1";

  function buildQuery(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { q, todos: showAll ? "1" : "", ...overrides };
    if (merged.q) params.set("q", merged.q);
    if (merged.todos === "1") params.set("todos", "1");
    const qs = params.toString();
    return qs ? `/em-importacao?${qs}` : "/em-importacao";
  }

  const searchCondition = q
    ? or(
        ilike(externalImportItems.sku, `%${q}%`),
        ilike(externalImportItems.description, `%${q}%`),
        ilike(externalImportItems.supplierName, `%${q}%`),
        ilike(externalImportItems.processNumber, `%${q}%`),
      )
    : undefined;

  const activeOnlyCondition = showAll
    ? undefined
    : notInArray(externalImportItems.status, [...EXTERNAL_IMPORT_ITEM_INACTIVE_STATUSES]);

  const conditions = [searchCondition, activeOnlyCondition].filter((c) => c !== undefined);

  const [rows, [{ inactiveCount }]] = await Promise.all([
    db
      .select({
        id: externalImportItems.id,
        sku: externalImportItems.sku,
        description: externalImportItems.description,
        quantity: externalImportItems.quantity,
        supplierName: externalImportItems.supplierName,
        processNumber: externalImportItems.processNumber,
        status: externalImportItems.status,
        eta: externalImportItems.eta,
      })
      .from(externalImportItems)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(externalImportItems.description)),
    db
      .select({ inactiveCount: sql<number>`count(*)`.mapWith(Number) })
      .from(externalImportItems)
      .where(
        and(
          ...[searchCondition, inArray(externalImportItems.status, [...EXTERNAL_IMPORT_ITEM_INACTIVE_STATUSES])].filter(
            (c) => c !== undefined,
          ),
        ),
      ),
  ]);

  return (
    <div className="p-6 md:p-10 max-w-[1300px] mx-auto w-full space-y-stack-lg">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-display-lg text-display-lg text-primary">Em Importação (Externo)</h2>
          <p className="text-on-surface-variant font-body-md text-body-md mt-1">
            Itens já em processo de importação, controlados fora do sistema. Ao montar um pedido de
            compra, o sistema avisa se o item escolhido já está aqui.
          </p>
        </div>
        <Link
          href="/em-importacao/novo"
          className="px-6 py-2.5 rounded-lg bg-secondary text-white font-label-md text-label-md hover:bg-secondary/90 transition-all shadow-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Novo Item
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form action="/em-importacao" className="relative max-w-md flex-1 min-w-[280px]">
          {showAll && <input type="hidden" name="todos" value="1" />}
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
            search
          </span>
          <input
            className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:border-secondary transition-colors font-body-md text-body-md"
            placeholder="Buscar por SKU, descrição, fornecedor ou processo..."
            type="text"
            name="q"
            defaultValue={q}
          />
        </form>

        {inactiveCount > 0 && (
          <Link
            href={buildQuery({ todos: showAll ? undefined : "1" })}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-label-md text-label-md border transition-colors ${
              showAll
                ? "bg-surface-container text-on-surface border-outline-variant"
                : "bg-surface-container-low text-on-surface-variant border-outline-variant hover:bg-surface-container"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">visibility_off</span>
            {showAll
              ? "Mostrando cancelados/consolidados — ocultar de novo"
              : `${inactiveCount} cancelado(s)/consolidado(s) oculto(s) — ver todos`}
          </Link>
        )}
      </div>

      <p className="font-label-md text-label-md text-on-surface-variant">
        {rows.length} {rows.length === 1 ? "item" : "itens"}
      </p>

      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">DESCRIÇÃO</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">SKU</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant text-right">QTD</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">FORNECEDOR</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">PROCESSO</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">STATUS</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">ETA</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant font-body-sm text-body-sm">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-6 text-on-surface-variant text-center">
                    {q ? "Nenhum item encontrado para essa busca." : "Nenhum item cadastrado ainda."}
                  </td>
                </tr>
              )}
              {rows.map((item) => {
                const status = item.status as ExternalImportItemStatus | null;
                const boundDelete = deleteExternalImportItem.bind(null, item.id);
                return (
                  <tr key={item.id} className="hover:bg-surface-container-high transition-colors">
                    <td className="px-6 py-3 max-w-[280px]">
                      <Link
                        href={`/em-importacao/${item.id}`}
                        className="text-secondary hover:underline font-medium line-clamp-1"
                        title={item.description}
                      >
                        {item.description}
                      </Link>
                    </td>
                    <td className="px-6 py-3 font-mono-data">{item.sku ?? "—"}</td>
                    <td className="px-6 py-3 font-mono-data text-right">{item.quantity ?? "—"}</td>
                    <td className="px-6 py-3">{item.supplierName ?? "—"}</td>
                    <td className="px-6 py-3 font-mono-data">{item.processNumber ?? "—"}</td>
                    <td className="px-6 py-3">
                      {status ? (
                        <span
                          className={`px-2 py-1 rounded-full font-label-md text-label-md ${EXTERNAL_IMPORT_ITEM_STATUS_BADGE_CLASS[status]}`}
                        >
                          {EXTERNAL_IMPORT_ITEM_STATUS_LABEL[status]}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-3">{formatDate(item.eta)}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/em-importacao/${item.id}`}
                          className="flex items-center gap-1 text-secondary hover:underline w-fit"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                          Editar
                        </Link>
                        <DeleteExternalImportItemButton
                          action={boundDelete}
                          description={item.description}
                          compact
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
