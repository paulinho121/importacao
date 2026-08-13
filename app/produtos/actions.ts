"use server";

import { db } from "@/db/client";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function optionalText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() || null;
}

function optionalNumber(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  return raw ? raw : null;
}

function readProductForm(formData: FormData) {
  const sku = String(formData.get("sku") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!sku) throw new Error("SKU interno é obrigatório.");
  if (!description) throw new Error("Descrição é obrigatória.");
  return {
    sku,
    description,
    manufacturerSku: optionalText(formData, "manufacturerSku"),
    ncm: optionalText(formData, "ncm"),
    defaultSupplierId: optionalText(formData, "defaultSupplierId"),
    costPrice: optionalNumber(formData, "costPrice"),
    costCurrency: optionalText(formData, "costCurrency") as
      | (typeof products.$inferInsert)["costCurrency"]
      | null,
    markupPercent: optionalNumber(formData, "markupPercent"),
    // Licenciamento de importação ("Inciso V") — todos opcionais.
    ncmAnterior: optionalText(formData, "ncmAnterior"),
    manufacturerName: optionalText(formData, "manufacturerName"),
    exporterName: optionalText(formData, "exporterName"),
    licenseNumber: optionalText(formData, "licenseNumber"),
    licenseRegisteredAt: optionalText(formData, "licenseRegisteredAt"),
    licenseStatus: optionalText(formData, "licenseStatus") as
      | (typeof products.$inferInsert)["licenseStatus"]
      | null,
    publicConsultationRef: optionalText(formData, "publicConsultationRef"),
    licenseApprovedAt: optionalText(formData, "licenseApprovedAt"),
    customsBrokerRef: optionalText(formData, "customsBrokerRef"),
    active: formData.get("active") === "on",
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

export async function resolveNcmDivergence(id: string, formData: FormData) {
  const action = formData.get("action");

  if (action === "accept") {
    const [product] = await db
      .select({ ncmOfficialSuggested: products.ncmOfficialSuggested })
      .from(products)
      .where(eq(products.id, id));
    await db
      .update(products)
      .set({
        ncm: product?.ncmOfficialSuggested ?? null,
        ncmDivergent: false,
        ncmOfficialSuggested: null,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id));
  } else {
    await db
      .update(products)
      .set({ ncmDivergent: false, updatedAt: new Date() })
      .where(eq(products.id, id));
  }

  revalidatePath("/produtos");
  revalidatePath(`/produtos/${id}`);
  revalidatePath("/");
}
