"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

// Boundary global — antes disso qualquer erro não tratado (ex: um
// `throw new Error("X é obrigatório")` de Server Action, ou uma falha de
// banco) caía na tela de erro genérica do Next, sem explicação nem
// caminho de volta. As mensagens que a aplicação lança já são escritas
// pra serem lidas pelo usuário (ex: "Descrição é obrigatória."), então
// error.message é seguro de mostrar direto.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-error-container text-on-error-container">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <div>
        <h1 className="font-display-lg text-display-lg text-primary">Não foi possível concluir</h1>
        <p className="mt-1 max-w-sm text-on-surface-variant font-body-md text-body-md">
          {error.message || "Ocorreu um erro inesperado. Tente novamente."}
        </p>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={reset}
          className="px-6 py-2.5 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all"
        >
          Tentar novamente
        </button>
        <Link
          href="/"
          className="px-6 py-2.5 rounded-lg border border-outline text-primary font-label-md text-label-md hover:bg-surface-container-high transition-all"
        >
          Ir para o Dashboard
        </Link>
      </div>
    </div>
  );
}
