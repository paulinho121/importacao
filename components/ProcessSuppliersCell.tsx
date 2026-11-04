import SupplierLogo from "@/components/SupplierLogo";
import type { ProcessSupplier } from "@/lib/process-purchase-orders";

// Fornecedores de um processo: o principal e os dos pedidos vinculados
// (um processo/contêiner reúne pedidos de vários fornecedores). Com um só, a
// etiqueta da logo + o nome; com vários, as etiquetas lado a lado e os nomes
// juntos ("APUTURE, SWIT").
export default function ProcessSuppliersCell({ suppliers, fallback }: { suppliers: ProcessSupplier[]; fallback: ProcessSupplier }) {
  const list = suppliers.length > 0 ? suppliers : [fallback];
  const shown = list.slice(0, 2);
  return (
    <span className="flex items-center gap-3" title={list.map((s) => s.name).join(", ")}>
      <span className="flex shrink-0 items-center gap-1">
        {shown.map((s) => (
          <SupplierLogo key={s.id} logoUrl={s.logoUrl} name={s.name} size={shown.length > 1 ? 24 : 32} />
        ))}
      </span>
      <span className="min-w-0 text-sm font-medium uppercase tracking-wide">
        {list.length === 1 ? list[0].name : list.map((s) => s.name).join(", ")}
      </span>
    </span>
  );
}
