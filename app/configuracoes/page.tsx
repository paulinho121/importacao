import { PageHeader } from "@/components/shared/PageHeader";
import CreateUserForm from "@/components/CreateUserForm";
import CreateBranchForm from "@/components/CreateBranchForm";
import DeleteBranchButton from "@/components/DeleteBranchButton";
import { requireAdmin } from "@/lib/supabase-server";
import { db } from "@/db/client";
import { profiles, companyBranches } from "@/db/schema";
import { deleteCompanyBranch } from "@/app/configuracoes/actions";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  await requireAdmin();

  const [users, branches] = await Promise.all([
    db.select().from(profiles).orderBy(profiles.createdAt),
    db.select().from(companyBranches).orderBy(companyBranches.name),
  ]);

  return (
    <div className="p-6 md:p-10 max-w-[1200px] mx-auto w-full space-y-stack-lg">
      <PageHeader title="Configurações" description="Usuários e acesso ao sistema" />

      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
        <h3 className="font-headline-sm text-headline-sm text-primary mb-4">Novo usuário</h3>
        <CreateUserForm />
      </section>

      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">NOME</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">E-MAIL</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">PAPEL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant font-body-sm text-body-sm">
              {users.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-6 text-on-surface-variant text-center">
                    Nenhum usuário cadastrado ainda.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-6 py-3">{u.name ?? "—"}</td>
                  <td className="px-6 py-3 font-mono-data">{u.email}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`px-2 py-1 rounded-full font-label-md text-label-md ${
                        u.role === "ADMIN"
                          ? "bg-secondary-fixed text-on-secondary-fixed-variant"
                          : "bg-surface-container-high text-on-surface-variant"
                      }`}
                    >
                      {u.role === "ADMIN" ? "Admin" : "Operador"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
        <h3 className="font-headline-sm text-headline-sm text-primary mb-1">Minha empresa (filiais)</h3>
        <p className="text-on-surface-variant font-body-sm text-body-sm mb-4">
          Aparecem como &quot;Comprador&quot; ao criar um pedido de compra e no documento impresso.
        </p>
        <CreateBranchForm />
      </section>

      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">NOME</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">CNPJ</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">ENDEREÇO</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant">PADRÃO</th>
                <th className="px-6 py-3 font-label-md text-label-md text-on-surface-variant text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant font-body-sm text-body-sm">
              {branches.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-on-surface-variant text-center">
                    Nenhuma filial cadastrada ainda.
                  </td>
                </tr>
              )}
              {branches.map((b) => (
                <tr key={b.id}>
                  <td className="px-6 py-3">{b.name}</td>
                  <td className="px-6 py-3 font-mono-data">{b.cnpj}</td>
                  <td className="px-6 py-3 text-on-surface-variant">{b.address}</td>
                  <td className="px-6 py-3">
                    {b.isDefault && (
                      <span className="px-2 py-1 rounded-full font-label-md text-label-md bg-secondary-fixed text-on-secondary-fixed-variant">
                        Padrão
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <DeleteBranchButton action={deleteCompanyBranch.bind(null, b.id)} name={b.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
