"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applyCpListResults, getProductsForCpList } from "@/app/produtos/actions";
import { listDateFromFileName, scanCpList } from "@/lib/cp-list";

// Upload manual da lista pública do governo (.ods). A planilha é lida aqui
// no navegador (é pesada pra mandar inteira ao servidor); o servidor recebe
// só quais produtos do catálogo aparecem nela.
export default function CpListUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      setMessage("Lendo a planilha — pode levar alguns segundos…");
      const catalog = await getProductsForCpList();
      const matches = await scanCpList(file, catalog);
      setMessage("Gravando o resultado…");
      const res = await applyCpListResults({
        source: file.name,
        listDate: listDateFromFileName(file.name),
        matches,
      });
      toast.success(
        `Varredura concluída: ${res.found} deferido(s), ${res.foundNational} com fabricante nacional, ${
          catalog.length - res.found - res.foundNational
        } não constam.`,
      );
      setMessage("");
      setFileName("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (e) {
      setMessage("");
      toast.error(e instanceof Error ? e.message : "Não foi possível ler a planilha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept=".ods,.xlsx,.xls"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
        disabled={busy}
        className="flex-1 min-w-0 text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-surface-container-high file:text-on-surface-variant"
      />
      <button
        type="button"
        onClick={run}
        disabled={busy || !fileName}
        className="px-4 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {busy ? "Verificando…" : "Verificar lista"}
      </button>
      {message && <span className="text-xs text-on-surface-variant">{message}</span>}
    </div>
  );
}
