import Link from "next/link";
import SupplierLogo from "@/components/SupplierLogo";
import { db } from "@/db/client";
import { suppliers, processes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function FornecedoresPage() {
  const rows = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      logoUrl: suppliers.logoUrl,
      country: suppliers.country,
      defaultIncoterm: suppliers.defaultIncoterm,
      contactName: suppliers.contactName,
      email: suppliers.email,
      processCount: sql<number>`count(${processes.id})`.mapWith(Number),
    })
    .from(suppliers)
    .leftJoin(processes, eq(processes.supplierId, suppliers.id))
    .groupBy(suppliers.id)
    .orderBy(suppliers.name);

  return (
    <div className="p-6 md:p-10 max-w-[1440px] mx-auto w-full space-y-stack-lg">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-display-lg text-display-lg text-primary">Fornecedores</h2>
          <p className="text-on-surface-variant font-body-md text-body-md mt-1">
            Cadastro mestre de fornecedores — processos referenciam este cadastro em vez de
            texto livre.
          </p>
        </div>
        <Link
          href="/fornecedores/novo"
          className="px-6 py-2.5 rounded-lg bg-secondary text-white font-label-md text-label-md hover:bg-secondary/90 transition-all shadow-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Novo Fornecedor
        </Link>
      </div>

      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">NOME</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">PAÍS</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">INCOTERM</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">CONTATO</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">PROCESSOS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant font-body-sm text-body-sm">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-on-surface-variant text-center">
                    Nenhum fornecedor cadastrado ainda.
                  </td>
                </tr>
              )}
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-surface-container-high transition-colors">
                  <td className="px-6 py-3 font-medium">
                    <Link
                      href={`/fornecedores/${s.id}`}
                      className="flex items-center gap-3 text-secondary hover:underline"
                    >
                      <SupplierLogo logoUrl={s.logoUrl} name={s.name} size={28} />
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3">{s.country ?? "—"}</td>
                  <td className="px-6 py-3">{s.defaultIncoterm ?? "—"}</td>
                  <td className="px-6 py-3">
                    {s.contactName ?? s.email ?? "—"}
                  </td>
                  <td className="px-6 py-3 font-mono-data">{s.processCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
