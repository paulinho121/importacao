"use server";

import { db } from "@/db/client";
import { freightAgents, processEvents, processFreightQuotes, processes } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withFlash, withFlashError } from "@/lib/flash";
import { freightToApply, formatMoney } from "@/lib/freight-quotes";

const CURRENCIES = ["USD", "EUR", "CNY", "GBP", "JPY", "OTHER", "BRL"] as const;
const MODALS = ["AIR", "SEA_FCL", "SEA_LCL", "SEA_BREAK_BULK", "SEA_RORO", "COURIER", "ROAD"] as const;
type Currency = (typeof CURRENCIES)[number];
type Modal = (typeof MODALS)[number];

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() || null;
}

// Aceita "1234.56" e "1.234,56"; vazio = não informado; inválido/negativo = erro.
function money(formData: FormData, key: string): string | null | "invalid" {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return "invalid";
  return n.toFixed(2);
}

function currency(formData: FormData, key: string, fallback: Currency): Currency {
  const v = String(formData.get(key) ?? "");
  return (CURRENCIES as readonly string[]).includes(v) ? (v as Currency) : fallback;
}

export async function saveFreightQuote(processId: string, quoteId: string | null, formData: FormData) {
  const back = `/processos/${processId}`;

  const agentId = text(formData, "agentId");
  if (!agentId) redirect(withFlashError(back, "Escolha o agente de carga da cotação."));
  const [agent] = await db.select({ name: freightAgents.name }).from(freightAgents).where(eq(freightAgents.id, agentId));
  if (!agent) redirect(withFlashError(back, "Agente de carga não encontrado."));

  const freightValue = money(formData, "freightValue");
  const originFeesValue = money(formData, "originFeesValue");
  const destinationFeesValue = money(formData, "destinationFeesValue");
  const otherFeesValue = money(formData, "otherFeesValue");
  if ([freightValue, originFeesValue, destinationFeesValue, otherFeesValue].includes("invalid")) {
    redirect(withFlashError(back, "Confira os valores: use só números, sem valores negativos."));
  }

  const transitRaw = text(formData, "transitDays");
  const transitDays = transitRaw ? Number.parseInt(transitRaw, 10) : null;
  if (transitRaw && (!Number.isFinite(transitDays) || (transitDays ?? 0) < 0)) {
    redirect(withFlashError(back, "Trânsito deve ser um número de dias."));
  }

  const modalRaw = text(formData, "modal");
  const modal = modalRaw && (MODALS as readonly string[]).includes(modalRaw) ? (modalRaw as Modal) : null;

  const values = {
    agentId,
    proposal: text(formData, "proposal"),
    modal,
    incoterm: text(formData, "incoterm"),
    carrier: text(formData, "carrier"),
    origin: text(formData, "origin"),
    destination: text(formData, "destination"),
    transitDays,
    validUntil: text(formData, "validUntil"),
    freightValue: freightValue as string | null,
    freightCurrency: currency(formData, "freightCurrency", "USD"),
    originFeesValue: originFeesValue as string | null,
    originFeesCurrency: currency(formData, "originFeesCurrency", "USD"),
    destinationFeesValue: destinationFeesValue as string | null,
    destinationFeesCurrency: currency(formData, "destinationFeesCurrency", "BRL"),
    otherFeesLabel: text(formData, "otherFeesLabel"),
    otherFeesValue: otherFeesValue as string | null,
    otherFeesCurrency: currency(formData, "otherFeesCurrency", "BRL"),
    notes: text(formData, "notes"),
  };

  if (quoteId) {
    const updated = await db
      .update(processFreightQuotes)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(processFreightQuotes.id, quoteId), eq(processFreightQuotes.processId, processId)))
      .returning({ id: processFreightQuotes.id });
    if (updated.length === 0) redirect(withFlashError(back, "Cotação não encontrada."));
  } else {
    await db.transaction(async (tx) => {
      await tx.insert(processFreightQuotes).values({ processId, ...values });
      await tx.insert(processEvents).values({
        processId,
        eventDate: new Date(),
        eventType: `Cotação de frete adicionada: ${agent.name}`,
      });
    });
  }

  revalidatePath(back);
  redirect(withFlash(back, quoteId ? "Cotação atualizada." : "Cotação adicionada."));
}

export async function deleteFreightQuote(quoteId: string, processId: string) {
  const back = `/processos/${processId}`;
  await db
    .delete(processFreightQuotes)
    .where(and(eq(processFreightQuotes.id, quoteId), eq(processFreightQuotes.processId, processId)));
  revalidatePath(back);
  redirect(withFlash(back, "Cotação removida."));
}

// Marca a cotação como a escolhida e leva o agente e o frete (+ taxas de
// origem) dela para o processo.
export async function selectFreightQuote(quoteId: string, processId: string) {
  const back = `/processos/${processId}`;

  const [quote] = await db
    .select()
    .from(processFreightQuotes)
    .where(and(eq(processFreightQuotes.id, quoteId), eq(processFreightQuotes.processId, processId)));
  if (!quote) redirect(withFlashError(back, "Cotação não encontrada."));

  const [process] = await db
    .select({ currency: processes.currency, incoterm: processes.incoterm, agentId: processes.agentId })
    .from(processes)
    .where(eq(processes.id, processId));
  if (!process) redirect(withFlashError(back, "Processo não encontrado."));

  const [agent] = quote.agentId
    ? await db.select({ name: freightAgents.name }).from(freightAgents).where(eq(freightAgents.id, quote.agentId))
    : [];
  const agentName = agent?.name ?? "agente";

  const apply = freightToApply(quote, process.currency);

  await db.transaction(async (tx) => {
    await tx
      .update(processFreightQuotes)
      .set({ isSelected: false })
      .where(eq(processFreightQuotes.processId, processId));
    await tx
      .update(processFreightQuotes)
      .set({ isSelected: true, updatedAt: new Date() })
      .where(eq(processFreightQuotes.id, quoteId));

    const patch: Partial<typeof processes.$inferInsert> = { updatedAt: new Date() };
    if (quote.agentId) patch.agentId = quote.agentId;
    if (!process.incoterm && quote.incoterm) patch.incoterm = quote.incoterm;
    if (apply.value !== null) {
      patch.internationalFreightValue = apply.value.toFixed(2);
      if (!process.currency) patch.currency = apply.currency as Currency;
    }
    await tx.update(processes).set(patch).where(eq(processes.id, processId));

    await tx.insert(processEvents).values({
      processId,
      eventDate: new Date(),
      eventType:
        apply.value !== null
          ? `Cotação de frete escolhida: ${agentName} · frete ${formatMoney(apply.value, apply.currency)}`
          : `Cotação de frete escolhida: ${agentName}`,
    });
  });

  revalidatePath(back);
  if (apply.value === null) {
    redirect(withFlash(back, `Cotação de ${agentName} escolhida. ${apply.reason}`));
  }
  redirect(
    withFlash(
      back,
      `Cotação de ${agentName} escolhida: Frete Internacional do processo agora é ${formatMoney(apply.value, apply.currency)}.`,
    ),
  );
}

// Tira a marca de "escolhida" (não mexe nos valores já levados ao processo).
export async function clearFreightQuoteSelection(processId: string) {
  const back = `/processos/${processId}`;
  await db
    .update(processFreightQuotes)
    .set({ isSelected: false })
    .where(eq(processFreightQuotes.processId, processId));
  revalidatePath(back);
  redirect(withFlash(back, "Escolha da cotação removida. O frete do processo continua como estava."));
}
