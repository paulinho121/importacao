"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function SupplierFilterSelect({
  suppliers,
  current,
}: {
  suppliers: { id: string; name: string; count: number }[];
  current: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <select
      value={current}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value) {
          params.set("fornecedor", e.target.value);
        } else {
          params.delete("fornecedor");
        }
        router.push(`/produtos${params.toString() ? `?${params.toString()}` : ""}`);
      }}
      className="px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:border-secondary transition-colors font-body-md text-body-md appearance-none"
    >
      <option value="">Todos os fornecedores</option>
      {suppliers.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name} ({s.count})
        </option>
      ))}
    </select>
  );
}
