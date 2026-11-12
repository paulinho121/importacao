"use client";

import { useEffect, useState } from "react";
import { driveDownloadUrl, driveOpenUrl, drivePreviewUrl } from "@/lib/drive-links";

// Ações de um link do Google Drive: VISUALIZAR (abre o arquivo na tela, num
// painel, sem sair da página) e BAIXAR (download direto). Quando o link não tem
// como ser mostrado dentro da página (pasta do Drive, outro site), "Visualizar"
// abre o link numa nova aba.
export default function DriveLinkActions({
  url,
  title = "Arquivo",
  compact = false,
  className = "",
}: {
  url: string | null | undefined;
  title?: string;
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const preview = drivePreviewUrl(url);
  const download = driveDownloadUrl(url);
  const openUrl = driveOpenUrl(url);

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

  if (!openUrl) return null;

  const btn = compact
    ? "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold"
    : "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold";
  const icon = compact ? "text-[14px]" : "text-[16px]";

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {preview ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={`Visualizar ${title.toLowerCase()} na tela`}
          className={`${btn} border border-secondary text-secondary hover:bg-secondary/10`}
        >
          <span className={`material-symbols-outlined ${icon}`}>visibility</span>
          Visualizar
        </button>
      ) : (
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`Abrir ${title.toLowerCase()} em uma nova aba`}
          className={`${btn} border border-secondary text-secondary hover:bg-secondary/10`}
        >
          <span className={`material-symbols-outlined ${icon}`}>open_in_new</span>
          Abrir
        </a>
      )}
      {download && (
        <a
          href={download}
          target="_blank"
          rel="noopener noreferrer"
          title={`Baixar ${title.toLowerCase()}`}
          className={`${btn} bg-secondary text-white hover:opacity-90`}
        >
          <span className={`material-symbols-outlined ${icon}`}>download</span>
          Baixar
        </a>
      )}

      {open && preview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="flex h-full max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-xl"
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant px-4 py-3">
              <span className="material-symbols-outlined text-primary">description</span>
              <span className="min-w-0 flex-1 truncate font-label-md text-label-md text-primary">{title}</span>
              <a
                href={openUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-outline px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                Abrir em nova aba
              </a>
              {download && (
                <a
                  href={download}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Baixar
                </a>
              )}
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
              <iframe src={preview} title={title} className="h-full w-full border-0" allow="autoplay" />
            </div>
            <p className="border-t border-outline-variant px-4 py-2 text-[11px] text-on-surface-variant">
              Se o arquivo não aparecer (arquivo privado ou sessão do Google expirada), use &quot;Abrir em nova aba&quot;.
            </p>
          </div>
        </div>
      )}
    </span>
  );
}
