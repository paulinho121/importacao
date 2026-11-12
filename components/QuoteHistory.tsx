"use client";

import { History } from "lucide-react";
import { formatDateTime, type QuoteEventRow } from "@/lib/quote-events";

// Histórico de uma cotação (fornecedor ou agente de cargas): seção recolhível,
// do evento mais recente para o mais antigo, com quem fez e quando.
export default function QuoteHistory({ events, className = "" }: { events: QuoteEventRow[]; className?: string }) {
  return (
    <details className={`group rounded-lg border border-outline-variant/60 bg-surface-container-low ${className}`}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant hover:text-secondary [&::-webkit-details-marker]:hidden">
        <History className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Histórico ({events.length})
        <span className="ml-auto text-[11px] font-normal normal-case text-outline group-open:hidden">mostrar</span>
        <span className="ml-auto hidden text-[11px] font-normal normal-case text-outline group-open:inline">recolher</span>
      </summary>
      {events.length === 0 ? (
        <p className="px-2 pb-2 text-[11px] text-on-surface-variant">Nenhum registro ainda.</p>
      ) : (
        <ol className="max-h-64 space-y-1.5 overflow-y-auto px-2 pb-2">
          {events.map((e) => (
            <li key={e.id} className="border-l-2 border-secondary/50 pl-2 text-[11px] leading-snug">
              <p className="break-words font-semibold text-on-surface">{e.description}</p>
              <p className="text-on-surface-variant">
                {e.actor ?? "—"} · {formatDateTime(e.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}
