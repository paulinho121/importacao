import { Info, CheckCircle2, AlertTriangle, XCircle, Siren, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertLevel = "info" | "success" | "warning" | "error" | "critical";

const LEVEL_CONFIG: Record<AlertLevel, { label: string; className: string; icon: LucideIcon }> = {
  info: { label: "Informação", className: "bg-accent text-accent-foreground", icon: Info },
  success: { label: "Sucesso", className: "bg-success/10 text-success", icon: CheckCircle2 },
  warning: { label: "Aviso", className: "bg-warning/10 text-warning", icon: AlertTriangle },
  error: { label: "Erro", className: "bg-destructive/10 text-destructive", icon: XCircle },
  critical: { label: "Crítico", className: "bg-destructive text-destructive-foreground", icon: Siren },
};

export function PriorityBadge({
  level,
  label,
  className,
}: {
  level: AlertLevel;
  label?: string;
  className?: string;
}) {
  const config = LEVEL_CONFIG[level];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        config.className,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label ?? config.label}
    </span>
  );
}
