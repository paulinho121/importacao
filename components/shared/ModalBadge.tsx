import { Package, Plane, Ship, Truck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const MODAL_ICON: Record<string, LucideIcon> = {
  AIR: Plane,
  SEA_FCL: Ship,
  SEA_LCL: Ship,
  SEA_BREAK_BULK: Ship,
  SEA_RORO: Ship,
  COURIER: Package,
  ROAD: Truck,
};

// Modal com ícone (avião/navio/…) ao lado do código — o código continua
// visível pra distinguir FCL de LCL.
export function ModalBadge({ modal, className }: { modal: string | null | undefined; className?: string }) {
  if (!modal) return <span className={className}>—</span>;
  const Icon = MODAL_ICON[modal];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {Icon && <Icon className="h-4 w-4 shrink-0 text-secondary" aria-hidden />}
      {modal}
    </span>
  );
}
