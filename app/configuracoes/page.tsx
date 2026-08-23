import AppShell from "@/components/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import CreateUserForm from "@/components/CreateUserForm";
import { requireAdmin } from "@/lib/supabase-server";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  await requireAdmin();

  const users = await db.select().from(profiles).orderBy(profiles.createdAt);

  return (
    <AppShell title="Configurações">
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
      </div>
    </AppShell>
  );
}
