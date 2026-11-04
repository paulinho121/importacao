"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

// Campo de busca da Consulta de Itens: pesquisa enquanto digita (com um
// pequeno atraso) trocando o ?q= da URL — a lista é renderizada no servidor.
export default function ItemSearchBox({ defaultValue, filtro }: { defaultValue: string; filtro: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [pending, startTransition] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (value.trim()) params.set("q", value.trim());
      if (filtro) params.set("filtro", filtro);
      const qs = params.toString();
      startTransition(() => router.replace(qs ? `/consulta?${qs}` : "/consulta"));
    }, 300);
    return () => clearTimeout(timer);
  }, [value, filtro, router]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
      <input
        autoFocus
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Pesquisar por nome, SKU, SKU do fabricante, NCM ou fabricante…"
        aria-label="Pesquisar item"
        className="w-full rounded-2xl border border-outline-variant bg-surface-container-lowest py-4 pl-14 pr-12 text-body-lg shadow-sm transition-colors focus:border-secondary focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Limpar pesquisa"
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-outline hover:text-on-surface"
        >
          <X className="h-5 w-5" />
        </button>
      )}
      {pending && (
        <span className="absolute -bottom-5 left-2 text-xs text-on-surface-variant">Pesquisando…</span>
      )}
    </div>
  );
}
