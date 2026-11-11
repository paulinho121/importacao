"use client";

import { useActionState } from "react";
import { Ship } from "lucide-react";
import { signIn, type SignInState } from "./actions";

const FIELD =
  "w-full rounded-lg border border-border bg-surface-container-low px-3.5 py-2.5 text-body-md font-body-md text-on-surface placeholder:text-muted-foreground transition-colors focus:border-secondary focus:outline-none";
const LABEL = "mb-1.5 block font-label-md text-label-md text-on-surface-variant";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState<SignInState, FormData>(signIn, null);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      {/* brilho discreto no topo: identidade sem competir com o formulário */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-secondary/10 blur-3xl"
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-on-secondary shadow-lg shadow-secondary/20">
            <Ship className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="font-display-lg text-display-lg text-primary">ImportFlow</h1>
          <p className="mt-1 text-on-surface-variant font-body-md text-body-md">
            Gestão de importações. Entre com seu e-mail e senha.
          </p>
        </div>

        <form
          action={formAction}
          className="space-y-4 rounded-2xl border border-border bg-card p-7 shadow-xl shadow-black/10"
        >
          <div>
            <label htmlFor="email" className={LABEL}>
              E-mail
            </label>
            <input
              id="email"
              className={FIELD}
              type="email"
              name="email"
              autoComplete="email"
              placeholder="voce@empresa.com.br"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className={LABEL}>
              Senha
            </label>
            <input
              id="password"
              className={FIELD}
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </div>

          {state?.error && (
            <p
              role="alert"
              className="rounded-lg border border-error-container/60 bg-error-container/20 p-2.5 text-xs font-medium text-error"
            >
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-secondary px-4 py-2.5 font-label-md text-label-md text-on-secondary shadow-sm transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
          >
            {isPending ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
