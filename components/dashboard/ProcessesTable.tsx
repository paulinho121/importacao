"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, Filter } from "lucide-react";
import { ModalBadge } from "@/components/shared/ModalBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import SupplierLogo from "@/components/SupplierLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, type ProcessStatus } from "@/lib/status";
import type { DashboardMetrics } from "@/lib/dashboard-metrics";

type Row = DashboardMetrics["table"][number];

const PAGE_SIZE = 6;

function fob(value: number | null, currency: string | null) {
  if (value === null) return "—";
  if (currency && currency !== "OTHER") {
    try {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      // código de moeda que o Intl não conhece: cai no número simples
    }
  }
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(
    value,
  );
}

// "Processos Recentes em Acompanhamento": os embarques ativos mais novos, com
// filtro por texto (o botão "Filtrar" ou Enter aplicam; apagar o campo limpa).
export function ProcessesTable({ data }: { data: Row[] }) {
  const [draft, setDraft] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(0);

  const apply = (value: string) => {
    setQuery(value.trim().toLowerCase());
    setPage(0);
  };

  const rows = React.useMemo(() => {
    if (!query) return data;
    return data.filter((r) =>
      [
        r.processNumber,
        r.supplierName,
        r.supplierCountry,
        r.destination,
        r.agentName,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(query)),
    );
  }, [data, query]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = rows.slice(
    current * PAGE_SIZE,
    current * PAGE_SIZE + PAGE_SIZE,
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold sm:text-lg tracking-tight text-on-surface">
            Processos Recentes em Acompanhamento
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Listagem dos últimos embarques marítimos e aéreos registrados
          </p>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            apply(draft);
          }}
        >
          <Input
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (e.target.value === "") apply("");
            }}
            placeholder="Filtrar tabela..."
            aria-label="Filtrar tabela"
            className="h-10 min-w-0 flex-1 sm:w-56 sm:flex-none"
          />
          <Button type="submit" variant="outline" className="h-10 gap-2">
            <Filter className="h-4 w-4" aria-hidden />
            Filtrar
          </Button>
        </form>
      </div>

      {visible.length === 0 ? (
        <div className="border-t border-border">
          <EmptyState
            title="Nenhum processo encontrado"
            description={
              query
                ? "Nenhum embarque combina com o filtro."
                : "Ainda não há processos em andamento."
            }
          />
        </div>
      ) : (
        <>
          <div className="hidden xl:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Ref. Processo</TableHead>
                  <TableHead>Fornecedor / Origem</TableHead>
                  <TableHead>Modal</TableHead>
                  <TableHead>ETA (Previsão)</TableHead>
                  <TableHead>Valor (FOB)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link
                        href={`/processos/${r.id}`}
                        className="font-mono text-sm font-semibold text-on-surface hover:text-secondary hover:underline whitespace-nowrap"
                      >
                        {r.processNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <SupplierLogo
                          logoUrl={r.supplierLogoUrl}
                          name={r.supplierName}
                          size={32}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium uppercase tracking-wide">
                            {r.supplierName}
                          </p>
                          {r.supplierCountry && (
                            <p className="text-xs text-muted-foreground">
                              {r.supplierCountry}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ModalBadge
                        modal={r.modal}
                        className="text-sm text-muted-foreground"
                      />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm whitespace-nowrap">
                        {formatDate(r.etaEstimated)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm whitespace-nowrap">
                        {fob(r.fobValue, r.currency)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status as ProcessStatus} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/processos/${r.id}`}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary hover:underline whitespace-nowrap"
                      >
                        Detalhes
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="grid gap-3 border-t border-border p-4 lg:grid-cols-2 sm:p-5 xl:hidden">
            {visible.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/processos/${r.id}`}
                  className="group block rounded-xl border border-border bg-background/40 p-4 transition active:scale-[0.99] hover:border-secondary/50 hover:bg-secondary/5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-sm font-bold text-on-surface">
                      {r.processNumber}
                    </span>
                    <StatusBadge status={r.status as ProcessStatus} />
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <SupplierLogo
                      logoUrl={r.supplierLogoUrl}
                      name={r.supplierName}
                      size={32}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold uppercase tracking-wide">
                        {r.supplierName}
                      </p>
                      {r.supplierCountry && (
                        <p className="text-xs text-muted-foreground">
                          {r.supplierCountry}
                        </p>
                      )}
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
                    <div className="min-w-0">
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Modal
                      </dt>
                      <dd className="mt-0.5 truncate text-sm">
                        <ModalBadge modal={r.modal} className="text-sm" />
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        ETA
                      </dt>
                      <dd className="mt-0.5 font-mono text-sm">
                        {formatDate(r.etaEstimated)}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        FOB
                      </dt>
                      <dd className="mt-0.5 truncate font-mono text-sm">
                        {fob(r.fobValue, r.currency)}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-3 flex items-center justify-end gap-1 text-sm font-medium text-secondary">
                    Ver detalhes
                    <ChevronRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
        <p className="text-sm text-muted-foreground">
          {rows.length === 0
            ? "0 processos"
            : `${current * PAGE_SIZE + 1}–${current * PAGE_SIZE + visible.length} de ${rows.length} processo${rows.length === 1 ? "" : "s"}`}
        </p>
        <div className="flex items-center gap-2">
          {pageCount > 1 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(current - 1)}
                disabled={current === 0}
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(current + 1)}
                disabled={current >= pageCount - 1}
                aria-label="Próxima página"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          <Link
            href="/processos"
            className="ml-2 text-sm font-medium text-secondary hover:underline"
          >
            Ver todos
          </Link>
        </div>
      </div>
    </section>
  );
}
