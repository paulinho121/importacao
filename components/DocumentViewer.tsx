"use client";

import { useEffect, useState } from "react";

type Sheet = { name: string; rows: string[][]; truncated: boolean };

const MAX_ROWS = 500;
const MAX_COLS = 40;

const extOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

// Planilha lida no navegador (SheetJS) e mostrada como tabela, uma aba por planilha.
function SheetPreview({ src }: { src: string }) {
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error("Não foi possível carregar o arquivo.");
        const { read, utils } = await import("xlsx");
        const wb = read(new Uint8Array(await res.arrayBuffer()), { type: "array" });
        const parsed = wb.SheetNames.map((name) => {
          const all = utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: "", raw: false });
          const filled = all.filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
          const rows = filled.slice(0, MAX_ROWS).map((r) => r.slice(0, MAX_COLS).map((c) => String(c ?? "")));
          return { name, rows, truncated: filled.length > MAX_ROWS };
        });
        if (!cancelled) setSheets(parsed);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Não foi possível ler a planilha.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (error) return <p className="p-6 text-body-sm text-error">{error}</p>;
  if (!sheets) return <p className="p-6 text-body-sm text-on-surface-variant">Carregando planilha…</p>;
  const sheet = sheets[active] ?? sheets[0];

  return (
    <div className="flex h-full flex-col">
      {sheets.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-outline-variant bg-surface-container-low px-3 pt-2">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              type="button"
              onClick={() => setActive(i)}
              className={`whitespace-nowrap rounded-t-lg px-3 py-1.5 text-xs font-bold ${
                i === active ? "bg-surface-container-lowest text-primary" : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto bg-surface-container-lowest">
        {sheet.rows.length === 0 ? (
          <p className="p-6 text-body-sm text-on-surface-variant">Esta planilha está vazia.</p>
        ) : (
          <table className="border-collapse text-xs">
            <tbody>
              {sheet.rows.map((row, r) => (
                <tr key={r} className={r === 0 ? "bg-surface-container-high font-bold" : "odd:bg-surface-container-low/50"}>
                  {row.map((cell, c) => (
                    <td key={c} className="whitespace-nowrap border border-outline-variant/60 px-2 py-1">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {sheet.truncated && (
          <p className="p-3 text-xs text-on-surface-variant">
            Mostrando as primeiras {MAX_ROWS} linhas. Baixe o arquivo para ver tudo.
          </p>
        )}
      </div>
    </div>
  );
}

// Nome do arquivo clicável: abre o conteúdo na tela (PDF, planilha ou imagem),
// com botão para baixar. `src` é a rota do app que entrega o arquivo.
export default function DocumentViewer({
  src,
  fileName,
  className = "",
}: {
  src: string;
  fileName: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ext = extOf(fileName);
  const isSheet = ["xlsx", "xls", "csv"].includes(ext);
  const isImage = ["png", "jpg", "jpeg"].includes(ext);
  const isPdf = ext === "pdf";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`text-left hover:underline ${className}`} title="Abrir na tela">
        {fileName}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={fileName}
            className="flex h-full max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-xl"
          >
            <div className="flex items-center gap-3 border-b border-outline-variant px-4 py-3">
              <span className="material-symbols-outlined text-primary">description</span>
              <span className="min-w-0 flex-1 truncate font-label-md text-label-md text-primary" title={fileName}>
                {fileName}
              </span>
              <a
                href={`${src}?download=1`}
                className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Baixar
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 bg-surface-container-low">
              {isPdf && <iframe src={src} title={fileName} className="h-full w-full border-0" />}
              {isImage && (
                // eslint-disable-next-line @next/next/no-img-element -- arquivo servido pela rota do app, tamanho desconhecido
                <img src={src} alt={fileName} className="mx-auto h-full max-w-full object-contain" />
              )}
              {isSheet && <SheetPreview src={src} />}
              {!isPdf && !isImage && !isSheet && (
                <p className="p-6 text-body-sm text-on-surface-variant">
                  Este tipo de arquivo não pode ser mostrado na tela. Use o botão Baixar.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
