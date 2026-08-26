"use client";

import { createCompanyBranch } from "@/app/configuracoes/actions";

export default function CreateBranchForm() {
  return (
    <form action={createCompanyBranch} className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-2">Nome</label>
        <input
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
          type="text"
          name="name"
          placeholder="Multicomercial e Importadora LTDA"
          required
        />
      </div>
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-2">CNPJ</label>
        <input
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-sm font-body-sm font-mono-data focus:outline-none focus:border-secondary transition-all"
          type="text"
          name="cnpj"
          placeholder="00.000.000/0001-00"
          required
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block font-label-md text-label-md text-on-surface-variant mb-2">Endereço</label>
        <input
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
          type="text"
          name="address"
          placeholder="Rua, número, bairro, CEP, cidade - UF"
          required
        />
      </div>
      <div className="sm:col-span-2 flex items-center justify-between">
        <label className="flex items-center gap-2 text-body-sm font-body-sm text-on-surface-variant">
          <input type="checkbox" name="isDefault" className="rounded border-outline-variant" />
          Usar como filial padrão em novos pedidos
        </label>
        <button
          type="submit"
          className="px-6 py-2.5 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all"
        >
          Cadastrar filial
        </button>
      </div>
    </form>
  );
}
