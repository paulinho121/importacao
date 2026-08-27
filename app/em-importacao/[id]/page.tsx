import { notFound } from "next/navigation";
import ExternalImportItemEditForm from "@/components/ExternalImportItemEditForm";
import DeleteExternalImportItemButton from "@/components/DeleteExternalImportItemButton";
import { updateExternalImportItem, deleteExternalImportItem } from "@/app/em-importacao/actions";
import { db } from "@/db/client";
import { externalImportItems } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function EditItemEmImportacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [item] = await db.select().from(externalImportItems).where(eq(externalImportItems.id, id));

  if (!item) notFound();

  const boundUpdate = updateExternalImportItem.bind(null, id);
  const boundDelete = deleteExternalImportItem.bind(null, id);

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto w-full">
      <div className="mb-8">
        <h2 className="font-display-lg text-display-lg text-primary">{item.description}</h2>
        <p className="text-on-surface-variant font-body-md text-body-md mt-1">
          Editar item já em processo de importação, controlado fora do sistema.
        </p>
      </div>
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 mb-6">
        <ExternalImportItemEditForm action={boundUpdate} defaultValues={item} submitLabel="Salvar Alterações" />
      </div>
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
        <DeleteExternalImportItemButton action={boundDelete} description={item.description} />
      </div>
    </div>
  );
}
