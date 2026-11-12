import { db } from "@/db/client";
import { processQuoteEvents } from "@/db/schema";
import { getCurrentUser } from "@/lib/supabase-server";
import type { QuoteEventType } from "@/lib/quote-events";

// Nome (ou e-mail) de quem está logado, para o histórico das cotações.
export async function quoteActorName(): Promise<string> {
  const user = await getCurrentUser().catch(() => null);
  return user?.name || user?.email || "usuário";
}

// Grava eventos no histórico de uma cotação (um por mudança). Aceita a
// transação em andamento para ficar atômico com a gravação da cotação.
export async function recordQuoteEvents(
  exec: Pick<typeof db, "insert">,
  params: {
    processId: string;
    quoteType: QuoteEventType;
    quoteId: string;
    descriptions: string[];
    actor: string;
  },
) {
  if (params.descriptions.length === 0) return;
  await exec.insert(processQuoteEvents).values(
    params.descriptions.map((description) => ({
      processId: params.processId,
      quoteType: params.quoteType,
      quoteId: params.quoteId,
      description,
      actor: params.actor,
    })),
  );
}
