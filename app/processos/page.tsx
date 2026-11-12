import { tipoEmbarqueLabel } from "@/lib/modais";
import { branchLabel, landingLabel } from "@/lib/locations";
import { ModalBadge } from "@/components/shared/ModalBadge";
import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db/client";
import { processes, suppliers, processItems, processInvoices, processDocuments, purchaseOrders, freightAgents } from "@/db/schema";
import ProcessSuppliersCell from "@/components/ProcessSuppliersCell";
import { getSuppliersByProcess } from "@/lib/process-purchase-orders";
import { and, desc, eq, ilike, inArray, notInArray, or, sql } from "drizzle-orm";
import { LATE_BY_ETA_SQL, etaLateDays, isCargoPresent } from "@/lib/eta-delay";
import { LateBadge } from "@/components/shared/StatusBadge";
import {
  STATUS_BADGE_CLASS,
  STATUS_ICON,
  STATUS_LABEL,
  WORKFLOW_STEPS,
  formatDate,
  diasRestantes,
  type ProcessStatus,
} from "@/lib/status";
import { DOC_TYPES_PER_PROCESS } from "@/lib/dashboard-metrics";

export const dynamic = "force-dynamic";

// Processos encerrados — não aparecem no fluxo, só em /finalizados.
const CLOSED_STATUSES: ProcessStatus[] = ["CONCLUIDO", "ABANDONADO"];

const MODAL_ICON: Record<string, string> = {
  AIR: "flight",
  SEA_FCL: "directions_boat",
  SEA_LCL: "directions_boat",
  SEA_BREAK_BULK: "directions_boat",
  SEA_RORO: "directions_boat",
  COURIER: "local_shipping",
  ROAD: "local_shipping",
};

export default async function ProcessosPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    modal?: string;
    status?: string;
    view?: string;
    ativos?: string;
    docsPendentes?: string;
    atrasados?: string;
  }>;
}) {
  const { q = "", modal = "", status = "", view = "list", ativos = "", docsPendentes = "", atrasados = "" } = await searchParams;
  const onlyAtrasados = atrasados === "1";
  const onlyAtivos = ativos === "1";
  const onlyDocsPendentes = docsPendentes === "1";

  // Finalizados e abandonados saíram do fluxo — ficam em /finalizados.
  // Links antigos (?status=CONCLUIDO) continuam funcionando via redirect.
  if (status === "CONCLUIDO" || status === "ABANDONADO") {
    redirect(status === "ABANDONADO" ? "/finalizados?status=ABANDONADO" : "/finalizados");
  }

  const conditions = [notInArray(processes.status, CLOSED_STATUSES)];
  if (modal) {
    conditions.push(eq(processes.modal, modal as (typeof processes.modal.enumValues)[number]));
  }
  if (status) {
    conditions.push(eq(processes.status, status as ProcessStatus));
  }
  // "Atrasados" é automático: ETA vencida e presença de carga ainda não confirmada (lib/eta-delay.ts).
  if (onlyAtrasados) conditions.push(sql.raw(`(${LATE_BY_ETA_SQL})`));
  // "Documentos Pendentes" vem do card de KPI do Dashboard — não é exclusivo
  // de "status" (não tem chip próprio na tela), então convive com ele.
  if (onlyDocsPendentes) {
    // Mesma regra do card "Documentos Pendentes": conta uploads com
    // status UPLOADED e considera pendente quem tem menos que o total de
    // tipos de documento esperado (INVOICE, BL, PACKING_LIST).
    conditions.push(
      sql`(
        select count(*) from ${processDocuments}
        where ${processDocuments.processId} = ${processes.id}
        and ${processDocuments.status} = 'UPLOADED'
      ) < ${DOC_TYPES_PER_PROCESS}`,
    );
  }
  const qCondition = q
    ? or(
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
      )
    : undefined;
  if (qCondition) conditions.push(qCondition);

  // A busca (inclusive a do topo da tela) só olha o fluxo; pra não "perder"
  // um processo já finalizado, avisa quantos batem lá em /finalizados.
  const closedMatches = qCondition
    ? (
        await db
          .select({ n: sql<number>`count(*)`.mapWith(Number) })
          .from(processes)
          .innerJoin(suppliers, eq(processes.supplierId, suppliers.id))
          .where(and(inArray(processes.status, CLOSED_STATUSES), qCondition))
      )[0].n
    : 0;

  const rows = await db
    .select({
      id: processes.id,
      processNumber: processes.processNumber,
      status: processes.status,
      modal: processes.modal,
      containerType: processes.containerType,
      etd: processes.etd,
      etaEstimated: processes.etaEstimated,
      destination: processes.destination,
      destinationCode: processes.destinationCode,
      destinationCity: processes.destinationCity,
      destinationState: processes.destinationState,
      destinationBranch: processes.destinationBranch,
      currentStep: processes.currentStep,
      agentName: freightAgents.name,
      externalReference: processes.externalReference,
      supplierName: suppliers.name,
      supplierLogoUrl: suppliers.logoUrl,
      itemCount: sql<number>`count(${processItems.id})`.mapWith(Number),
      firstSku: sql<string | null>`min(${processItems.sku})`,
    })
    .from(processes)
    .innerJoin(suppliers, eq(processes.supplierId, suppliers.id))
    .leftJoin(freightAgents, eq(processes.agentId, freightAgents.id))
    .leftJoin(processItems, eq(processItems.processId, processes.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(processes.id, suppliers.name, suppliers.logoUrl, freightAgents.name)
    .orderBy(desc(processes.createdAt));

  const suppliersByProcess = await getSuppliersByProcess(rows.map((r) => r.id));
  // Invoices de cada processo (a planilha mostra Invoice 1 a 4 na própria linha).
  const invoiceRows = rows.length
    ? await db
        .select({ processId: processInvoices.processId, invoiceNumber: processInvoices.invoiceNumber })
        .from(processInvoices)
        .where(inArray(processInvoices.processId, rows.map((r) => r.id)))
        .orderBy(processInvoices.createdAt)
    : [];
  const invoicesByProcess = new Map<string, string[]>();
  for (const inv of invoiceRows) invoicesByProcess.set(inv.processId, [...(invoicesByProcess.get(inv.processId) ?? []), inv.invoiceNumber]);
  const todayUtc = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());

  // Lista única, sem faixas de status — o status aparece só na coluna
  // Status (ou no selo do card). Ordem: número do processo, do maior pro
  // menor, comparando a parte numérica como número (FIRST29 antes de FIRST04).
  const sortedRows = [...rows].sort((a, b) =>
    b.processNumber.localeCompare(a.processNumber, "pt-BR", { numeric: true }),
  );

  return (
    <>
      <div className="p-gutter lg:px-stack-lg lg:pt-stack-lg flex justify-end">
      <Link
        href="/processos/novo"
        className="px-6 py-2.5 rounded-lg bg-secondary text-white font-label-md text-label-md hover:bg-secondary/90 transition-all shadow-sm flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
        Novo Processo
      </Link>
    </div>
    <div className="p-gutter lg:px-stack-lg">
      {onlyDocsPendentes && (
        <Link
          href={{ pathname: "/processos", query: q ? { q } : {} }}
          className="mb-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-label-md text-label-md border bg-secondary/10 text-secondary border-secondary/30 hover:bg-secondary/20 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">filter_alt</span>
          Filtrando: processos com documento pendente — ver todos
        </Link>
      )}
      {closedMatches > 0 && (
        <Link
          href={{ pathname: "/finalizados", query: { q } }}
          className="mb-4 ml-0 flex w-fit items-center gap-1.5 px-4 py-2.5 rounded-xl font-label-md text-label-md border border-outline-variant text-on-surface-variant hover:bg-surface-container-high transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">inventory_2</span>
          {closedMatches} {closedMatches === 1 ? "processo encerrado também bate" : "processos encerrados também batem"} com
          essa busca — ver em Finalizados
        </Link>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href={{ pathname: "/processos", query: onlyAtrasados ? (q ? { q } : {}) : { ...(q ? { q } : {}), atrasados: "1" } }}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 font-label-md text-label-md transition-colors ${
            onlyAtrasados
              ? "border-error/40 bg-error-container text-on-error-container"
              : "border-outline-variant text-on-surface-variant hover:bg-surface-container-high"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">warning</span>
          {onlyAtrasados ? "Somente atrasados (ETA vencida) — ver todos" : "Ver somente atrasados"}
        </Link>
      </div>
      <form className="flex flex-col md:flex-row gap-4 items-end md:items-center" action="/processos">
        {status && <input type="hidden" name="status" value={status} />}
        {modal && <input type="hidden" name="modal" value={modal} />}
        {view !== "list" && <input type="hidden" name="view" value={view} />}
        {onlyAtivos && <input type="hidden" name="ativos" value="1" />}
        {onlyDocsPendentes && <input type="hidden" name="docsPendentes" value="1" />}
        {onlyAtrasados && <input type="hidden" name="atrasados" value="1" />}
        <div className="relative flex-1 w-full">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
            search
          </span>
          <input
            className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:border-secondary transition-colors font-body-md text-body-md"
            placeholder="Buscar por processo, produto, fornecedor ou invoice..."
            type="text"
            name="q"
            defaultValue={q}
          />
        </div>
      </form>
    </div>

    <div className="p-gutter lg:px-stack-lg pb-32">
      {rows.length === 0 && (
        <p className="text-on-surface-variant font-body-md text-body-md">Nenhum processo encontrado.</p>
      )}

      {rows.length > 0 && view === "list" && (
        <>
          {/* Visualização em cartões responsivos no Mobile / Tablet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
            {sortedRows.map((p) => {
              const progress = Math.round((p.currentStep / WORKFLOW_STEPS.length) * 100);
              const dias = diasRestantes(p.etaEstimated);
              const invs = invoicesByProcess.get(p.id) ?? [];
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/processos/${p.id}`}
                        className="font-mono text-base font-bold text-secondary hover:underline truncate block"
                      >
                        {p.processNumber}
                      </Link>
                      <div className="mt-1 flex items-center gap-2">
                        <ProcessSuppliersCell
                          suppliers={suppliersByProcess.get(p.id) ?? []}
                          fallback={{ id: p.id, name: p.supplierName, logoUrl: p.supplierLogoUrl }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={p.status as ProcessStatus} />
                      <LateBadge days={etaLateDays(p)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border">
                    <div>
                      <span className="text-muted-foreground block">Modal / Tipo:</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <ModalBadge modal={p.modal} />
                        <span className="text-muted-foreground truncate">{tipoEmbarqueLabel(p.modal, p.containerType)}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">ETA Prevista:</span>
                      <span className="font-mono font-medium text-foreground">
                        {formatDate(p.etaEstimated)}
                        {dias !== null && !isCargoPresent(p.currentStep) && (
                          <span
                            className={`ml-1 text-[11px] ${
                              dias < 0 ? "font-bold text-destructive" : dias <= 7 ? "font-bold text-warning" : "text-muted-foreground"
                            }`}
                          >
                            ({dias}d)
                          </span>
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Desembarque:</span>
                      <span className="text-foreground truncate block">{landingLabel(p)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Filial Destino:</span>
                      <span className="text-foreground truncate block">{branchLabel(p.destinationBranch)}</span>
                    </div>
                  </div>

                  <div className="space-y-1 pt-2 border-t border-border">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progresso ({p.currentStep}/{WORKFLOW_STEPS.length})</span>
                      <span className="font-medium text-foreground">{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-secondary" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  {invs.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 text-xs">
                      <span className="text-muted-foreground mr-1">Invoices:</span>
                      {invs.slice(0, 3).map((n) => (
                        <span key={n} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                          {n}
                        </span>
                      ))}
                      {invs.length > 3 && <span className="text-[11px] text-muted-foreground">+{invs.length - 3}</span>}
                    </div>
                  )}

                  <div className="pt-2 border-t border-border flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">
                      {p.itemCount} {p.itemCount === 1 ? "item" : "itens"}
                      {p.firstSku ? ` · SKU: ${p.firstSku}` : ""}
                    </span>
                    <Link
                      href={`/processos/${p.id}`}
                      className="inline-flex items-center gap-1 font-semibold text-secondary hover:underline"
                    >
                      Ver Processo
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabela completa em telas maiores (Desktop) */}
          <div className="hidden lg:block overflow-hidden rounded-card border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Processo</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Tipo de embarque</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Ref. do agente</TableHead>
                  <TableHead>ETD</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>Trânsito</TableHead>
                  <TableHead>Dias restantes</TableHead>
                  <TableHead>Desembarque</TableHead>
                  <TableHead>Filial destino</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invoices</TableHead>
                  <TableHead>Itens</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((p) => {
                      const progress = Math.round((p.currentStep / WORKFLOW_STEPS.length) * 100);
                      return (
                        <TableRow key={p.id} className="cursor-pointer">
                          <TableCell className="p-0">
                            <Link href={`/processos/${p.id}`} className="block px-4 py-3 font-mono text-sm text-secondary hover:underline whitespace-nowrap">
                              {p.processNumber}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link href={`/processos/${p.id}`} className="flex items-center gap-2">
                              <ProcessSuppliersCell
                                suppliers={suppliersByProcess.get(p.id) ?? []}
                                fallback={{ id: p.id, name: p.supplierName, logoUrl: p.supplierLogoUrl }}
                              />
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground"><ModalBadge modal={p.modal} /></TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{tipoEmbarqueLabel(p.modal, p.containerType)}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{p.agentName ?? "—"}</TableCell>
                          <TableCell className="font-mono text-sm whitespace-nowrap">{p.externalReference ?? "—"}</TableCell>
                          <TableCell className="font-mono text-sm">{formatDate(p.etd)}</TableCell>
                          <TableCell className="font-mono text-sm">{formatDate(p.etaEstimated)}</TableCell>
                          <TableCell>
                            {p.status === "EM_TRANSITO" && p.etd && p.etaEstimated ? (
                              (() => {
                                const start = new Date(`${p.etd}T00:00:00Z`).getTime();
                                const end = new Date(`${p.etaEstimated}T00:00:00Z`).getTime();
                                const pct = end > start ? Math.max(0, Math.min(100, ((todayUtc - start) / (end - start)) * 100)) : 0;
                                return (
                                  <div className="h-2 w-24 overflow-hidden rounded-full bg-muted" title={`${Math.round(pct)}% do trajeto`}>
                                    <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                                  </div>
                                );
                              })()
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm text-center">
                            {(() => {
                              if (isCargoPresent(p.currentStep)) return <span className="text-muted-foreground">—</span>;
                              const dias = diasRestantes(p.etaEstimated);
                              if (dias === null) return <span className="text-muted-foreground">—</span>;
                              return <span className={dias < 0 ? "font-bold text-destructive" : dias <= 7 ? "font-bold text-warning" : ""}>{dias}</span>;
                            })()}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{landingLabel(p)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{branchLabel(p.destinationBranch)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                <div className="h-full rounded-full bg-secondary" style={{ width: `${progress}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground">{progress}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <StatusBadge status={p.status as ProcessStatus} />
                              <LateBadge days={etaLateDays(p)} />
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {(() => {
                              const invs = invoicesByProcess.get(p.id) ?? [];
                              if (invs.length === 0) return <span className="text-muted-foreground">—</span>;
                              return (
                                <span className="flex flex-wrap gap-1" title={invs.join(", ")}>
                                  {invs.slice(0, 3).map((n) => (
                                    <span key={n} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                                      {n}
                                    </span>
                                  ))}
                                  {invs.length > 3 && <span className="text-xs text-muted-foreground">+{invs.length - 3}</span>}
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {p.itemCount} {p.itemCount === 1 ? "item" : "itens"}
                            {p.firstSku ? ` · SKU: ${p.firstSku}` : ""}
                          </TableCell>
                        </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {rows.length > 0 && view !== "list" && (
      <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedRows.map((p) => {
          const progress = Math.round((p.currentStep / WORKFLOW_STEPS.length) * 100);
          const badgeClass = STATUS_BADGE_CLASS[p.status as ProcessStatus];
          return (
            <Link
              key={p.id}
              href={`/processos/${p.id}`}
              className="group bg-surface-container-lowest border border-outline-variant p-5 rounded-xl hover:shadow-lg transition-all cursor-pointer flex flex-col gap-4 relative overflow-hidden"
            >
              <div
                className={`absolute top-0 left-0 w-1 h-full ${
                  etaLateDays(p) ? "bg-error" : "bg-secondary"
                }`}
              />
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-mono-data text-mono-data text-outline mb-1">
                    {p.processNumber}
                  </h3>
                  {p.supplierLogoUrl ? (
                    <Image
                      src={p.supplierLogoUrl}
                      alt={p.supplierName}
                      width={160}
                      height={40}
                      unoptimized
                      className="h-10 w-auto max-w-[180px] object-contain object-left mt-1"
                    />
                  ) : (
                    <p className="font-headline-sm text-headline-sm text-primary">
                      {p.supplierName}
                    </p>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full font-label-md text-label-md flex items-center gap-1 ${badgeClass}`}>
                  <span className="material-symbols-outlined text-[14px]">
                    {STATUS_ICON[p.status as ProcessStatus]}
                  </span>
                  {STATUS_LABEL[p.status as ProcessStatus]}
                </span>
                <LateBadge days={etaLateDays(p)} className="ml-1" />
              </div>
              <div className="grid grid-cols-2 gap-4 my-2">
                <div>
                  <span className="font-label-md text-label-md text-outline block">ETD</span>
                  <span className="font-body-md text-body-md text-on-surface font-bold">
                    {formatDate(p.etd)}
                  </span>
                </div>
                <div>
                  <span className="font-label-md text-label-md text-outline block">ETA</span>
                  <span className="font-body-md text-body-md text-on-surface font-bold">
                    {formatDate(p.etaEstimated)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center font-label-md text-label-md">
                  <span className="text-outline">Progresso do fluxo</span>
                  <span className="text-secondary font-bold">{progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                  <div
                    className="bg-secondary h-full rounded-full transition-all duration-1000"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2 border-t border-outline-variant">
                <span className="material-symbols-outlined text-outline">
                  {MODAL_ICON[p.modal ?? ""] ?? "help"}
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  {p.modal ?? "Modal não informado"} · {p.itemCount}{" "}
                  {p.itemCount === 1 ? "item" : "itens"}
                  {p.firstSku ? ` · SKU: ${p.firstSku}` : ""}
                </span>
              </div>
            </Link>
          );
        })}
            </div>
      </div>
      )}
    </div>
    </>
  );
}
