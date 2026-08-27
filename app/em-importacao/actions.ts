"use server";

import { db } from "@/db/client";
import { externalImportItems } from "@/db/schema";
import { eq, ilike, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase-server";

function optionalText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() || null;
}

function optionalNumber(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  return raw ? raw : null;
}

function readForm(formData: FormData) {
  const description = optionalText(formData, "description");
  if (!description) throw new Error("Descrição é obrigatória.");

  return {
    sku: optionalText(formData, "sku"),
    description,
    quantity: optionalNumber(formData, "quantity"),
    supplierName: optionalText(formData, "supplierName"),
    processNumber: optionalText(formData, "processNumber"),
    status: optionalText(formData, "status") as (typeof externalImportItems.$inferInsert)["status"] | null,
    modal: optionalText(formData, "modal"),
    invoice: optionalText(formData, "invoice"),
    etd: optionalText(formData, "etd"),
    eta: optionalText(formData, "eta"),
    agent: optionalText(formData, "agent"),
    destination: optionalText(formData, "destination"),
    reservation: optionalText(formData, "reservation"),
    notes: optionalText(formData, "notes"),
  };
}

export async function createExternalImportItem(formData: FormData) {
  const values = readForm(formData);
  const user = await getCurrentUser();
  await db.insert(externalImportItems).values({ ...values, createdByUserId: user?.id ?? null });
  revalidatePath("/em-importacao");
}

export async function updateExternalImportItem(id: string, formData: FormData) {
  const values = readForm(formData);
  await db
    .update(externalImportItems)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(externalImportItems.id, id));
  revalidatePath("/em-importacao");
}

export async function deleteExternalImportItem(id: string) {
  await db.delete(externalImportItems).where(eq(externalImportItems.id, id));
  revalidatePath("/em-importacao");
}

// Usado pelo formulário de item do pedido de compra: ao escolher um
// produto do catálogo, checa se algo parecido já está em importação
// (por SKU exato ou descrição em comum) — só avisa, não bloqueia nada.
export async function checkExternalImportMatch(sku: string | null, description: string) {
  const skuCondition = sku ? ilike(externalImportItems.sku, sku) : undefined;
  const descWords = description
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .slice(0, 4);
  const descCondition = descWords.length > 0 ? or(...descWords.map((w) => ilike(externalImportItems.description, `%${w}%`))) : undefined;

  const condition = skuCondition && descCondition ? or(skuCondition, descCondition) : (skuCondition ?? descCondition);
  if (!condition) return [];

  return db
    .select({
      id: externalImportItems.id,
      sku: externalImportItems.sku,
      description: externalImportItems.description,
      quantity: externalImportItems.quantity,
      processNumber: externalImportItems.processNumber,
      status: externalImportItems.status,
      eta: externalImportItems.eta,
    })
    .from(externalImportItems)
    .where(condition)
    .limit(5);
}
