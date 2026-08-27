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
//
// A busca no banco (por SKU exato OU qualquer palavra em comum) é
// deliberadamente ampla, só pra trazer um lote de candidatos — o filtro
// que decide o que de fato é "parecido" roda em JS depois, exigindo SKU
// exato OU pelo menos 2 palavras significativas em comum. Com 1 palavra
// só, praticamente qualquer item da mesma marca (ex: "amaran", "aputure")
// batia e a lista de avisos virava ruído.
function normalizeWord(word: string) {
  return word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").toLowerCase();
}

export async function checkExternalImportMatch(sku: string | null, description: string) {
  const skuLower = sku?.trim().toLowerCase() || null;
  const descWords = Array.from(
    new Set(
      description
        .split(/\s+/)
        .map(normalizeWord)
        .filter((w) => w.length >= 4),
    ),
  ).slice(0, 8);

  const skuCondition = skuLower ? ilike(externalImportItems.sku, skuLower) : undefined;
  const descCondition =
    descWords.length > 0 ? or(...descWords.map((w) => ilike(externalImportItems.description, `%${w}%`))) : undefined;

  const condition = skuCondition && descCondition ? or(skuCondition, descCondition) : (skuCondition ?? descCondition);
  if (!condition) return [];

  const candidates = await db
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
    .limit(40);

  // Quantas palavras significativas exigir em comum: com só 1 disponível
  // (ex: "camera"), essa 1 já basta; com 2+, exige pelo menos 2 — evita
  // que uma palavra genérica isolada (marca, "with", "for"...) sozinha
  // dispare o aviso pra itens sem relação nenhuma.
  const minWordMatches = Math.min(2, descWords.length);

  const scored = candidates
    .map((c) => {
      const exactSku = skuLower !== null && c.sku?.trim().toLowerCase() === skuLower;
      const candidateDescLower = c.description.toLowerCase();
      const wordMatches = descWords.filter((w) => candidateDescLower.includes(w)).length;
      return { item: c, exactSku, wordMatches };
    })
    .filter((c) => c.exactSku || c.wordMatches >= minWordMatches)
    .sort((a, b) => Number(b.exactSku) - Number(a.exactSku) || b.wordMatches - a.wordMatches);

  return scored.slice(0, 5).map((c) => c.item);
}
