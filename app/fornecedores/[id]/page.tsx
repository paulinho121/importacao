import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import SupplierForm from "@/components/SupplierForm";
import { updateSupplier } from "@/app/fornecedores/actions";
import { db } from "@/db/client";
import { suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function EditFornecedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));

  if (!supplier) notFound();

  const boundUpdate = updateSupplier.bind(null, id);

  return (
    <AppShell title="Editar Fornecedor">
      <div className="p-6 md:p-10 max-w-3xl mx-auto w-full">
        <div className="mb-8">
          <h2 className="font-display-lg text-display-lg text-primary">{supplier.name}</h2>
          <p className="text-on-surface-variant font-body-md text-body-md mt-1">
            Editar dados do fornecedor.
          </p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8">
          <SupplierForm
            action={boundUpdate}
            defaultValues={supplier}
            submitLabel="Salvar Alterações"
          />
        </div>
      </div>
    </AppShell>
  );
}
