import {
  Clock,
  Receipt,
  Factory,
  PlaneTakeoff,
  Truck,
  Gavel,
  PackageCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Boxes,
  Hourglass,
  UserCheck,
  ClipboardCheck,
  BadgeCheck,
  Search,
  FileWarning,
  Anchor,
  Warehouse,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_BADGE_CLASS, STATUS_LABEL, type ProcessStatus } from "@/lib/status";

const STATUS_LUCIDE_ICON: Record<ProcessStatus, LucideIcon> = {
  PEDIDO: Receipt,
  AGUARDANDO_APROVACAO: Hourglass,
  PEDIDO_CONFIRMADO: BadgeCheck,
  AGUARDANDO_PRODUCAO: Clock,
  PRODUCAO: Factory,
  PRODUCAO_CONCLUIDA: CheckCircle2,
  AGUARDANDO_COLETA_ORIGEM: Clock,
  COLETADO_ORIGEM: Boxes,
  AGUARDANDO_EMBARQUE: Clock,
  EMBARCADO: PlaneTakeoff,
  EM_TRANSITO: Truck,
  AGUARDANDO_PRESENCA_CARGA: Hourglass,
  PRESENCA_CARGA: UserCheck,
  CARGA_REGISTRADA: ClipboardCheck,
  EM_ANALISE_ADUANEIRA: Search,
  EM_EXIGENCIA: FileWarning,
  EM_DESEMBARACO: Gavel,
  AGUARDANDO_LIBERACAO_TERMINAL: Anchor,
  AGUARDANDO_RETIRADA: Clock,
  TRANSPORTE_NACIONAL: Truck,
  RECEBIDO: Warehouse,
  EM_CONFERENCIA: ClipboardList,
  EM_ESTOQUE: PackageCheck,
  CONCLUIDO: CheckCircle2,
  ABANDONADO: XCircle,
  ATRASADO: AlertTriangle,
};

// Indicador automático de atraso (ETA vencida sem presença de carga): aparece ao
// lado do status, não substitui o status.
export function LateBadge({ days, className }: { days: number | null | undefined; className?: string }) {
  if (!days) return null;
  return (
    <span
      title={`ETA vencida há ${days} dia(s) e a presença de carga ainda não foi confirmada`}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-error-container px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-on-error-container",
        className,
      )}
    >
      <AlertTriangle className="h-3 w-3" aria-hidden />
      Atrasado · {days}d
    </span>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: ProcessStatus;
  className?: string;
}) {
  const Icon = STATUS_LUCIDE_ICON[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        STATUS_BADGE_CLASS[status],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {STATUS_LABEL[status]}
    </span>
  );
}
