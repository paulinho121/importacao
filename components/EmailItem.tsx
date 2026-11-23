import type { ReactNode } from "react";
import { formatBytes, type EmailView } from "@/lib/process-emails";
import { formatDateTime } from "@/lib/quote-events";

// Um e-mail: remetente, assunto, data, corpo recolhível e anexos. Usado nas telas
// de processo e de não vinculados. O corpo é texto puro (React escapa tudo): nunca HTML.
export default function EmailItem({ email, children }: { email: EmailView; children?: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="min-w-0">
        <p className="font-semibold text-on-surface break-words">{email.subject || "(sem assunto)"}</p>
        <p className="text-xs text-on-surface-variant break-words">
          {email.from || "Remetente desconhecido"} · {formatDateTime(email.sentAt.toISOString())}
        </p>
        {email.snippet && <p className="text-sm text-on-surface-variant line-clamp-2 mt-1">{email.snippet}</p>}
      </div>

      <details>
        <summary className="cursor-pointer select-none text-xs font-bold text-secondary hover:underline">
          Ver e-mail
        </summary>
        <div className="mt-2 rounded-lg bg-surface-container-low p-3 space-y-2">
          {email.to && <p className="text-xs text-on-surface-variant break-words">Para: {email.to}</p>}
          <pre className="whitespace-pre-wrap break-words font-body-sm text-body-sm text-on-surface max-h-[480px] overflow-auto">
            {email.bodyText?.trim() || "(este e-mail não tem texto)"}
          </pre>
        </div>
      </details>

      {email.attachments.length > 0 && (
        <ul className="flex flex-wrap gap-2 pt-1">
          {email.attachments.map((a) => (
            <li key={a.id}>
              {a.url ? (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-2.5 py-1 text-xs hover:bg-surface-container-high transition-all"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary">attach_file</span>
                  <span className="break-all">{a.fileName}</span>
                  {a.sizeBytes ? <span className="text-on-surface-variant">({formatBytes(a.sizeBytes)})</span> : null}
                </a>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-outline px-2.5 py-1 text-xs text-error"
                  title="Este anexo não foi salvo na importação."
                >
                  <span className="material-symbols-outlined text-[16px]">attach_file_off</span>
                  <span className="break-all">{a.fileName}</span>
                  <span>indisponível</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {children}
    </div>
  );
}
