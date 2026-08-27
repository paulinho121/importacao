import { notFound } from "next/navigation";
import SupplierForm from "@/components/SupplierForm";
import SupplierLogo from "@/components/SupplierLogo";
import { updateSupplier, uploadSupplierLogo } from "@/app/fornecedores/actions";
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
  const boundUploadLogo = uploadSupplierLogo.bind(null, id);

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto w-full">
      <div className="mb-8">
        <h2 className="font-display-lg text-display-lg text-primary">{supplier.name}</h2>
        <p className="text-on-surface-variant font-body-md text-body-md mt-1">
          Editar dados do fornecedor.
        </p>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 mb-6">
        <h3 className="font-headline-sm text-headline-sm text-primary mb-4">Logo da Marca</h3>
        <div className="flex items-center gap-6">
          <SupplierLogo logoUrl={supplier.logoUrl} name={supplier.name} size={64} />
          <form action={boundUploadLogo} className="flex-1 flex flex-col sm:flex-row gap-3">
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              required
              className="flex-1 text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-surface-container-high file:text-on-surface-variant"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all whitespace-nowrap"
            >
              {supplier.logoUrl ? "Substituir Logo" : "Enviar Logo"}
            </button>
          </form>
        </div>
        <p className="text-xs text-on-surface-variant mt-3">
          Envie o arquivo oficial do logo da marca (PNG, JPG, SVG ou WebP, até 2MB).
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
  );
}
