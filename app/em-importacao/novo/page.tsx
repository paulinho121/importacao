import ExternalImportItemEditForm from "@/components/ExternalImportItemEditForm";
import { createExternalImportItem } from "@/app/em-importacao/actions";

export const dynamic = "force-dynamic";

export default function NovoItemEmImportacaoPage() {
  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto w-full">
      <div className="mb-8">
        <h2 className="font-display-lg text-display-lg text-primary">Novo Item em Importação</h2>
        <p className="text-on-surface-variant font-body-md text-body-md mt-1">
          Registrar um item que já está em processo de importação, controlado fora do sistema.
        </p>
      </div>
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8">
        <ExternalImportItemEditForm action={createExternalImportItem} submitLabel="Cadastrar Item" />
      </div>
    </div>
  );
}
