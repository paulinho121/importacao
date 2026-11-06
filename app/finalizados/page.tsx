import { tipoEmbarqueLabel } from "@/lib/modais";
import { branchLabel, landingLabel } from "@/lib/locations";
import { ModalBadge } from "@/components/shared/ModalBadge";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db/client";
import { processes, suppliers, freightAgents, processItems, processInvoices, purchaseOrders } from "@/db/schema";
import ProcessSuppliersCell from "@/components/ProcessSuppliersCell";
import { getSuppliersByProcess } from "@/lib/process-purchase-orders";
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { formatDate, type ProcessStatus } from "@/lib/status";
import { MODAIS } from "@/lib/modais";

import SubmitButton from "@/components/SubmitButton";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const CLOSED_STATUSES: ProcessStatus[] = ["CONCLUIDO", "ABANDONADO"];

// Data de referência do processo encerrado: fechamento, senão chegada real,
// senão ETA estimado, senão ETD — a planilha nem sempre preenche todas.
const refDate = sql`coalesce(${processes.closedAt}, ${processes.etaActual}, ${processes.etaEstimated}, ${processes.etd})`;

type SearchParams = {
  q?: string;
  fornecedor?: string;
  agente?: string;
  modal?: string;
  status?: string;
  de?: string;
  ate?: string;
  page?: string;
};

const SELECT_CLASS =
  "w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all appearance-none";
const LABEL_CLASS = "block font-label-md text-label-md text-on-surface-variant mb-1";

export default async function FinalizadosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const fornecedor = sp.fornecedor ?? "";
  const agente = sp.agente ?? "";
  const modal = sp.modal ?? "";
  const status = sp.status === "CONCLUIDO" || sp.status === "ABANDONADO" ? sp.status : "";
  const de = /^\d{4}-\d{2}-\d{2}$/.test(sp.de ?? "") ? sp.de! : "";
  const ate = /^\d{4}-\d{2}-\d{2}$/.test(sp.ate ?? "") ? sp.ate! : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const conditions: SQL[] = [
    status ? eq(processes.status, status) : inArray(processes.status, CLOSED_STATUSES),
  ];
  if (fornecedor) conditions.push(eq(processes.supplierId, fornecedor));
  if (agente) conditions.push(eq(processes.agentId, agente));
  if (modal) conditions.push(eq(processes.modal, modal as (typeof processes.modal.enumValues)[number]));
  if (de) conditions.push(sql`${refDate} >= ${de}::date`);
  if (ate) conditions.push(sql`${refDate} <= ${ate}::date`);
  if (q) {
    conditions.push(
      or(
        ilike(processes.processNumber, `%${q}%`),
        ilike(suppliers.name, `%${q}%`),
        sql`exists (
          select 1 from ${purchaseOrders} po join ${suppliers} ps on ps.id = po.supplier_id
          where po.process_id = ${processes.id}
          and (po.po_number ilike ${`%${q}%`} or ps.name ilike ${`%${q}%`})
        )`,
        sql`exists (
          select 1 from ${processInvoices}
          where ${processInvoices.processId} = ${processes.id}
          and ${processInvoices.invoiceNumber} ilike ${`%${q}%`}
        )`,
        sql`exists (
          select 1 from ${processItems}
          where ${processItems.processId} = ${processes.id}
          and (${processItems.sku} ilike ${`%${q}%`} or ${processItems.description} ilike ${`%${q}%`})
        )`,
      )!,
    );
  }
  const where = and(...conditions);

  const [rows, [{ total }], supplierOptions, agentOptions] = await Promise.all([
    db
      .select({
        id: processes.id,
        processNumber: processes.processNumber,
        status: processes.status,
        modal: processes.modal,
        containerType: processes.containerType,
        etd: processes.etd,
        etaEstimated: processes.etaEstimated,
        closedAt: processes.closedAt,
        destination: processes.destination,
        destinationCode: processes.destinationCode,
        destinationCity: processes.destinationCity,
        destinationState: processes.destinationState,
        destinationBranch: processes.destinationBranch,
        supplierName: suppliers.name,
        supplierLogoUrl: suppliers.logoUrl,
        agentName: freightAgents.name,
        itemCount: sql<number>`count(${processItems.id})`.mapWith(Number),
      })
      .from(processes)
      .innerJoin(suppliers, eq(processes.supplierId, suppliers.id))
      .leftJoin(freightAgents, eq(processes.agentId, freightAgents.id))
      .leftJoin(processItems, eq(processItems.processId, processes.id))
      .where(where)
      .groupBy(processes.id, suppliers.name, suppliers.logoUrl, freightAgents.name)
      .orderBy(sql`${refDate} desc nulls last`, desc(processes.processNumber))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(processes)
      .innerJoin(suppliers, eq(processes.supplierId, suppliers.id))
      .where(where),
    db
      .selectDistinct({ id: suppliers.id, name: suppliers.name })
      .from(processes)
      .innerJoin(suppliers, eq(processes.supplierId, suppliers.id))
      .where(inArray(processes.status, CLOSED_STATUSES))
      .orderBy(suppliers.name),
    db
      .selectDistinct({ id: freightAgents.id, name: freightAgents.name })
      .from(processes)
      .innerJoin(freightAgents, eq(processes.agentId, freightAgents.id))
      .where(inArray(processes.status, CLOSED_STATUSES))
      .orderBy(freightAgents.name),
  ]);

  const suppliersByProcess = await getSuppliersByProcess(rows.map((r) => r.id));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(q || fornecedor || agente || modal || status || de || ate);

  function pageHref(target: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (fornecedor) params.set("fornecedor", fornecedor);
    if (agente) params.set("agente", agente);
    if (modal) params.set("modal", modal);
    if (status) params.set("status", status);
    if (de) params.set("de", de);
    if (ate) params.set("ate", ate);
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `/finalizados?${qs}` : "/finalizados";
  }

  return (
    <div className="p-gutter lg:px-stack-lg lg:pt-stack-lg space-y-stack-md pb-12">
      <div>
        <h2 className="font-display-lg text-display-lg text-primary">Processos Finalizados</h2>
        <p className="text-on-surface-variant font-body-md text-body-md mt-1">
          Arquivo dos processos encerrados (finalizados e abandonados). Eles saem do fluxo de
          Processos — aqui você consulta e filtra.
        </p>
      </div>

      <form
        action="/finalizados"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-surface-container-lowest border border-outline-variant rounded-xl p-4"
      >
        <div className="lg:col-span-2">
          <label className={LABEL_CLASS}>Buscar</label>
          <input
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Nº do processo, fornecedor, invoice, SKU ou nome do item..."
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Fornecedor</label>
          <select className={SELECT_CLASS} name="fornecedor" defaultValue={fornecedor}>
            <option value="">Todos</option>
            {supplierOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Agente de carga</label>
          <select className={SELECT_CLASS} name="agente" defaultValue={agente}>
            <option value="">Todos</option>
            {agentOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Modal</label>
          <select className={SELECT_CLASS} name="modal" defaultValue={modal}>
            <option value="">Todos</option>
            {MODAIS.filter((m) => m.value).map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Situação</label>
          <select className={SELECT_CLASS} name="status" defaultValue={status}>
            <option value="">Finalizados e abandonados</option>
            <option value="CONCLUIDO">Só finalizados</option>
            <option value="ABANDONADO">Só abandonados</option>
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Período — de</label>
          <input
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
            type="date"
            name="de"
            defaultValue={de}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Período — até</label>
          <input
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
            type="date"
            name="ate"
            defaultValue={ate}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-3">
          <SubmitButton
            className="px-6 py-2.5 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all"
          >
            Filtrar
          </SubmitButton>
          {hasFilters && (
            <Link
              href="/finalizados"
              className="px-4 py-2.5 rounded-lg border border-outline-variant text-on-surface-variant font-label-md text-label-md hover:bg-surface-container-high transition-colors"
            >
              Limpar filtros
            </Link>
          )}
          <span className="ml-auto text-xs text-on-surface-variant">
            Período considera a data de fechamento (ou chegada, se não houver).
          </span>
        </div>
      </form>

      <p className="font-label-md text-label-md text-on-surface-variant">
        {total} {total === 1 ? "processo" : "processos"}
        {hasFilters ? " com esses filtros" : ""}
      </p>

      <div className="overflow-hidden rounded-card border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Processo</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Agente</TableHead>
              <TableHead>Modalidade</TableHead>
              <TableHead>Tipo de embarque</TableHead>
              <TableHead>ETD</TableHead>
              <TableHead>ETA</TableHead>
              <TableHead>Fechamento</TableHead>
              <TableHead>Desembarque</TableHead>
              <TableHead>Filial destino</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Itens</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={12} className="py-8 text-center text-muted-foreground">
                  {hasFilters ? "Nenhum processo encerrado com esses filtros." : "Nenhum processo encerrado ainda."}
                </TableCell>
              </TableRow>
            )}
            {rows.map((p) => (
              <TableRow key={p.id} className="cursor-pointer">
                <TableCell className="p-0">
                  <Link
                    href={`/processos/${p.id}`}
                    className="block px-4 py-3 font-mono text-sm text-secondary hover:underline whitespace-nowrap"
                  >
                    {p.processNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/processos/${p.id}`} className="flex items-center gap-2 whitespace-nowrap">
                    <ProcessSuppliersCell
                      suppliers={suppliersByProcess.get(p.id) ?? []}
                      fallback={{ id: p.id, name: p.supplierName, logoUrl: p.supplierLogoUrl }}
                    />
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{p.agentName ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground"><ModalBadge modal={p.modal} /></TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{tipoEmbarqueLabel(p.modal, p.containerType)}</TableCell>
                <TableCell className="font-mono text-sm whitespace-nowrap">{formatDate(p.etd)}</TableCell>
                <TableCell className="font-mono text-sm whitespace-nowrap">{formatDate(p.etaEstimated)}</TableCell>
                <TableCell className="font-mono text-sm whitespace-nowrap">{formatDate(p.closedAt)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{landingLabel(p)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{branchLabel(p.destinationBranch)}</TableCell>
                <TableCell>
                  <StatusBadge status={p.status as ProcessStatus} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {p.itemCount} {p.itemCount === 1 ? "item" : "itens"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Paginação">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="px-4 py-2 rounded-lg border border-outline-variant font-label-md text-label-md hover:bg-surface-container-high transition-colors"
            >
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-on-surface-variant">
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="px-4 py-2 rounded-lg border border-outline-variant font-label-md text-label-md hover:bg-surface-container-high transition-colors"
            >
              Próxima →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
