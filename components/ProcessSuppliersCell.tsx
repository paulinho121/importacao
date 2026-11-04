import SupplierLogo from "@/components/SupplierLogo";
import type { ProcessSupplier } from "@/lib/process-purchase-orders";

// Fornecedores de um processo: o principal e os dos pedidos vinculados
// (um processo/contêiner reúne pedidos de vários fornecedores).
export default function ProcessSuppliersCell({ suppliers, fallback }: { suppliers: ProcessSupplier[]; fallback: ProcessSupplier }) {
  const list = suppliers.length > 0 ? suppliers : [fallback];
  return (
    <span className="flex items-center gap-2" title={list.map((s) => s.name).join(", ")}>
      <span className="flex -space-x-2">
        {list.slice(0, 3).map((s) => (
          <SupplierLogo key={s.id} logoUrl={s.logoUrl} name={s.name} size={32} />
        ))}
      </span>
      <span className="text-sm">
        {list.length === 1 ? list[0].name : `${list[0].name} +${list.length - 1}`}
      </span>
    </span>
  );
}
