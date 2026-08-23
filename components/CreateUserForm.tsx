"use client";

import { useActionState, useRef, useEffect } from "react";
import { createUser, type CreateUserState } from "@/app/configuracoes/actions";

export default function CreateUserForm() {
  const [state, formAction, isPending] = useActionState<CreateUserState, FormData>(createUser, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === null) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-2">Nome</label>
        <input
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
          type="text"
          name="name"
        />
      </div>
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-2">E-mail</label>
        <input
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
          type="email"
          name="email"
          required
        />
      </div>
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
          Senha temporária
        </label>
        <input
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
          type="text"
          name="password"
          required
          minLength={6}
        />
      </div>
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-2">Papel</label>
        <select
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all appearance-none"
          name="role"
          defaultValue="OPERADOR"
        >
          <option value="OPERADOR">Operador</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
      <div className="sm:col-span-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2.5 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 disabled:opacity-60 transition-all"
        >
          {isPending ? "Criando..." : "Criar usuário"}
        </button>
        {state?.error && <p className="text-sm text-error">{state.error}</p>}
      </div>
    </form>
  );
}
