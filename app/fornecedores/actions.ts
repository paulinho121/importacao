"use server";

import { db } from "@/db/client";
import { suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function readSupplierForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("Nome do fornecedor é obrigatório.");
  }
  return {
    name,
    country: String(formData.get("country") ?? "").trim() || null,
    defaultIncoterm: String(formData.get("defaultIncoterm") ?? "").trim() || null,
    contactName: String(formData.get("contactName") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createSupplier(formData: FormData) {
  const values = readSupplierForm(formData);
  const [created] = await db.insert(suppliers).values(values).returning({ id: suppliers.id });
  revalidatePath("/fornecedores");
  redirect(`/fornecedores/${created.id}`);
}

export async function updateSupplier(id: string, formData: FormData) {
  const values = readSupplierForm(formData);
  await db
    .update(suppliers)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(suppliers.id, id));
  revalidatePath("/fornecedores");
  revalidatePath(`/fornecedores/${id}`);
  redirect("/fornecedores");
}
