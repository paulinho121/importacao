"use client";

import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { ExternalLink } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import SupplierLogo from "@/components/SupplierLogo";
import { formatDate, type ProcessStatus } from "@/lib/status";
import type { DashboardMetrics } from "@/lib/dashboard-metrics";

type Row = DashboardMetrics["table"][number];

const columns: ColumnDef<Row>[] = [
  {
    accessorKey: "processNumber",
    header: "Processo",
    cell: ({ row }) => (
      <Link href={`/processos/${row.original.id}`} className="font-mono text-sm text-secondary hover:underline">
        {row.original.processNumber}
      </Link>
    ),
  },
  {
    accessorKey: "supplierName",
    header: "Fornecedor",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <SupplierLogo logoUrl={row.original.supplierLogoUrl} name={row.original.supplierName} size={22} />
        <span className="text-sm">{row.original.supplierName}</span>
      </div>
    ),
  },
  {
    accessorKey: "modal",
    header: "Modal",
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.modal ?? "—"}</span>,
  },
  {
    accessorKey: "destination",
    header: "Destino",
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.destination}</span>,
  },
  {
    accessorKey: "etaEstimated",
    header: "ETA",
    cell: ({ row }) => <span className="font-mono text-sm">{formatDate(row.original.etaEstimated)}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status as ProcessStatus} />,
  },
  {
    accessorKey: "agentName",
    header: "Responsável",
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.agentName ?? "—"}</span>,
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <Link
        href={`/processos/${row.original.id}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-on-surface transition-colors"
      >
        <ExternalLink className="h-4 w-4" />
      </Link>
    ),
  },
];

export function ProcessesTable({ data }: { data: Row[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Buscar processo ou fornecedor..."
      emptyTitle="Nenhum processo encontrado"
    />
  );
}
