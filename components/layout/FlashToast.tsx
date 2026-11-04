"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

// Lê ?flash=... (sucesso) ou ?flashError=... (erro) uma vez (postos pelas
// Server Actions via lib/flash.ts após um redirect()), mostra o toast e limpa
// o parâmetro da URL — assim um refresh da página não dispara o toast de novo.
export default function FlashToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const flash = searchParams.get("flash");
  const flashError = searchParams.get("flashError");
  const shown = useRef<string | null>(null);

  useEffect(() => {
    const message = flash ?? flashError;
    if (!message || shown.current === message) return;
    shown.current = message;
    if (flash) toast.success(flash);
    else toast.error(message, { duration: 8000 });

    const params = new URLSearchParams(searchParams);
    params.delete("flash");
    params.delete("flashError");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a flash/flashError mudar; router/pathname/searchParams são lidos no disparo, não devem re-executar o efeito.
  }, [flash, flashError]);

  return null;
}
