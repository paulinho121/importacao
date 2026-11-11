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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_BADGE_CLASS, STATUS_LABEL, type ProcessStatus } from "@/lib/status";

const STATUS_LUCIDE_ICON: Record<ProcessStatus, LucideIcon> = {
  PEDIDO: Receipt,
  PRODUCAO: Factory,
  COLETADO_ORIGEM: Boxes,
  AGUARDANDO_EMBARQUE: Clock,
  EMBARCADO: PlaneTakeoff,
  EM_TRANSITO: Truck,
  AGUARDANDO_PRESENCA_CARGA: Hourglass,
  PRESENCA_CARGA: UserCheck,
  EM_DESEMBARACO: Gavel,
  CARGA_REGISTRADA: ClipboardCheck,
  TRANSPORTE_NACIONAL: Truck,
  RECEBIDO: PackageCheck,
  ATRASADO: AlertTriangle,
  CONCLUIDO: CheckCircle2,
  ABANDONADO: XCircle,
};

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
