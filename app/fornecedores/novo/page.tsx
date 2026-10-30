import SupplierForm from "@/components/SupplierForm";
import { createSupplier } from "@/app/fornecedores/actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NovoFornecedorPage() {
  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto w-full">
      <Link
        href="/fornecedores"
        className="mb-6 flex w-fit items-center gap-2 text-secondary font-semibold hover:underline group"
      >
        <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1">
          arrow_back
        </span>
        <span className="font-label-md text-label-md">VOLTAR PARA FORNECEDORES</span>
      </Link>

      <div className="mb-8">
        <h2 className="font-display-lg text-display-lg text-primary">
          Cadastro de Fornecedor
        </h2>
        <p className="text-on-surface-variant font-body-md text-body-md mt-1">
          Onboard de novos parceiros no ecossistema ImportFlow.
        </p>
      </div>
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8">
        <SupplierForm action={createSupplier} submitLabel="Cadastrar Fornecedor" />
      </div>
    </div>
  );
}
