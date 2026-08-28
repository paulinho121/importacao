"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

// Lê ?flash=... uma vez (posto pelas Server Actions via lib/flash.ts após
// um redirect()), mostra o toast e limpa o parâmetro da URL — assim um
// refresh da página não dispara o toast de novo.
export default function FlashToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const flash = searchParams.get("flash");
  const shown = useRef<string | null>(null);

  useEffect(() => {
    if (!flash || shown.current === flash) return;
    shown.current = flash;
    toast.success(flash);

    const params = new URLSearchParams(searchParams);
    params.delete("flash");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a flash mudar; router/pathname/searchParams são lidos no disparo, não devem re-executar o efeito.
  }, [flash]);

  return null;
}
