"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState<SignInState, FormData>(signIn, null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display-lg text-display-lg text-primary">ImportFlow</h1>
          <p className="text-on-surface-variant font-body-md text-body-md mt-1">
            Entre com seu e-mail e senha.
          </p>
        </div>

        <form
          action={formAction}
          className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 space-y-4"
        >
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              E-mail
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
              type="email"
              name="email"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              Senha
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </div>

          {state?.error && (
            <p className="text-xs text-error font-medium bg-error-container/20 border border-error-container/50 rounded-lg p-2">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full px-4 py-3 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 disabled:opacity-60 transition-all"
          >
            {isPending ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
