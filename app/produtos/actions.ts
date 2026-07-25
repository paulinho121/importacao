"use server";

import { db } from "@/db/client";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function readProductForm(formData: FormData) {
  const sku = String(formData.get("sku") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!sku) throw new Error("SKU interno é obrigatório.");
  if (!description) throw new Error("Descrição é obrigatória.");
  return {
    sku,
    description,
    manufacturerSku: String(formData.get("manufacturerSku") ?? "").trim() || null,
    ncm: String(formData.get("ncm") ?? "").trim() || null,
    defaultSupplierId: String(formData.get("defaultSupplierId") ?? "").trim() || null,
  };
}

export async function createProduct(formData: FormData) {
  const values = readProductForm(formData);
  const [created] = await db.insert(products).values(values).returning({ id: products.id });
  revalidatePath("/produtos");
  redirect(`/produtos/${created.id}`);
}

export async function updateProduct(id: string, formData: FormData) {
  const values = readProductForm(formData);
  await db
    .update(products)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(products.id, id));
  revalidatePath("/produtos");
  revalidatePath(`/produtos/${id}`);
  redirect("/produtos");
}
