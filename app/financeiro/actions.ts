"use server";

import { db } from "@/db/client";
import { processPayables } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/supabase-server";

function optionalText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() || null;
}

function optionalDate(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() || null;
}

export async function createPayable(processId: string, formData: FormData) {
  await requireAdmin();
  const user = await getCurrentUser();

  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const amount = String(formData.get("amount") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim();
  if (!category) throw new Error("Categoria é obrigatória.");
  if (!description) throw new Error("Descrição é obrigatória.");
  if (!amount) throw new Error("Valor é obrigatório.");
  if (!currency) throw new Error("Moeda é obrigatória.");

  await db.insert(processPayables).values({
    processId,
    category: category as (typeof processPayables.$inferInsert)["category"],
    description,
    amount,
    currency: currency as (typeof processPayables.$inferInsert)["currency"],
    dueDate: optionalDate(formData, "dueDate"),
    notes: optionalText(formData, "notes"),
    createdByUserId: user?.id ?? null,
  });

  revalidatePath(`/processos/${processId}`);
  revalidatePath("/financeiro");
}

export async function markPayableAsPaid(payableId: string, formData: FormData) {
  await requireAdmin();
  const paidAt = optionalDate(formData, "paidAt") ?? new Date().toISOString().slice(0, 10);

  await db.update(processPayables).set({ paidAt, updatedAt: new Date() }).where(eq(processPayables.id, payableId));

  revalidatePath("/financeiro");
  const [payable] = await db.select({ processId: processPayables.processId }).from(processPayables).where(eq(processPayables.id, payableId));
  if (payable) revalidatePath(`/processos/${payable.processId}`);
}

export async function updatePayable(payableId: string, formData: FormData) {
  await requireAdmin();

  const dueDate = optionalDate(formData, "dueDate");
  const notes = optionalText(formData, "notes");

  await db
    .update(processPayables)
    .set({ dueDate, notes, updatedAt: new Date() })
    .where(eq(processPayables.id, payableId));

  revalidatePath("/financeiro");
}
