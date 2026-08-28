"use server";

import { db } from "@/db/client";
import { products, productPriceTiers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withFlash } from "@/lib/flash";

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
    // Alíquotas de importação do NCM — todas opcionais, cadastradas
    // manualmente (ver lib/import-tax.ts).
    taxRateII: optionalNumber(formData, "taxRateII"),
    taxRateIPI: optionalNumber(formData, "taxRateIPI"),
    taxRatePIS: optionalNumber(formData, "taxRatePIS"),
    taxRateCOFINS: optionalNumber(formData, "taxRateCOFINS"),
    taxRateICMS: optionalNumber(formData, "taxRateICMS"),
    // Especificações de carton — base pra estimar cubagem/containers no
    // Pedido de Compra (ver lib/container-estimate.ts). Todas opcionais.
    cartonPiecesPerCarton: optionalNumber(formData, "cartonPiecesPerCarton"),
    cartonLengthCm: optionalNumber(formData, "cartonLengthCm"),
    cartonWidthCm: optionalNumber(formData, "cartonWidthCm"),
    cartonHeightCm: optionalNumber(formData, "cartonHeightCm"),
    cartonWeightKg: optionalNumber(formData, "cartonWeightKg"),
  };
}

export async function createProduct(formData: FormData) {
  const values = readProductForm(formData);
  const [created] = await db.insert(products).values(values).returning({ id: products.id });
  revalidatePath("/produtos");
  redirect(withFlash(`/produtos/${created.id}`, "Produto cadastrado."));
}

export async function updateProduct(id: string, formData: FormData) {
  const values = readProductForm(formData);
  await db
    .update(products)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(products.id, id));
  revalidatePath("/produtos");
  revalidatePath(`/produtos/${id}`);
  redirect(withFlash("/produtos", "Alterações salvas."));
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

export async function addPriceTier(productId: string, formData: FormData) {
  const minQuantity = String(formData.get("minQuantity") ?? "").trim();
  const price = String(formData.get("price") ?? "").trim();
  if (!minQuantity || Number(minQuantity) <= 0) throw new Error("Quantidade mínima deve ser maior que zero.");
  if (!price || Number(price) <= 0) throw new Error("Preço deve ser maior que zero.");

  await db.insert(productPriceTiers).values({ productId, minQuantity, price });

  revalidatePath(`/produtos/${productId}`);
}

export async function removePriceTier(tierId: string, productId: string) {
  await db.delete(productPriceTiers).where(eq(productPriceTiers.id, tierId));
  revalidatePath(`/produtos/${productId}`);
}
