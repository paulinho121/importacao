"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { confirmCpMatch, rejectCpMatch } from "@/app/produtos/actions";

// Botões "Confirmar correspondência" / "Não é este produto". Rodam sem sair da
// tela (sem redirecionar nem recarregar), para quem está editando o produto não
// perder o que já digitou no formulário — o resultado aparece num aviso.
export default function CpMatchReview({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();

  function run(action: (id: string) => Promise<{ message: string }>) {
    startTransition(async () => {
      try {
        const res = await action(productId);
        toast.success(res.message);
      } catch {
        toast.error("Não foi possível registrar a conferência. Tente novamente.");
      }
    });
  }

  return (
    <div className="flex basis-full flex-wrap items-center gap-2 border-t border-outline-variant pt-3">
      <span className="mr-1 text-body-sm font-body-sm text-on-surface-variant">O item da lista é este produto?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(confirmCpMatch)}
        className="px-4 py-2 rounded-lg bg-secondary text-white text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50"
      >
        {pending ? "Salvando…" : "Confirmar correspondência"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(rejectCpMatch)}
        className="px-4 py-2 rounded-lg border border-outline text-primary text-sm font-bold hover:bg-surface-container-high transition-all disabled:opacity-50"
      >
        Não é este produto
      </button>
    </div>
  );
}
