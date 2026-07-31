import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PriorityBadge, type AlertLevel } from "@/components/shared/PriorityBadge";

export function AlertCard({
  level,
  title,
  description,
  responsible,
  daysOverdue,
  href,
}: {
  level: AlertLevel;
  title: string;
  description?: string;
  responsible?: string;
  daysOverdue?: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-3 transition-colors hover:bg-muted/60"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge level={level} />
          {typeof daysOverdue === "number" && daysOverdue > 0 && (
            <span className="text-xs font-medium text-destructive">
              {daysOverdue} {daysOverdue === 1 ? "dia" : "dias"} em atraso
            </span>
          )}
        </div>
        <p className="mt-1.5 truncate text-sm font-medium text-on-surface">{title}</p>
        {description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>}
        {responsible && <p className="mt-1 text-xs text-muted-foreground">Responsável: {responsible}</p>}
      </div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
