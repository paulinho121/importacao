"use server";

import { db } from "@/db/client";
import { suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin, LOGOS_BUCKET } from "@/lib/supabase-admin";

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
    fax: String(formData.get("fax") ?? "").trim() || null,
    manufacturerAddress: String(formData.get("manufacturerAddress") ?? "").trim() || null,
    exporterName: String(formData.get("exporterName") ?? "").trim() || null,
    exporterAddress: String(formData.get("exporterAddress") ?? "").trim() || null,
    bankBeneficiary: String(formData.get("bankBeneficiary") ?? "").trim() || null,
    bankAccount: String(formData.get("bankAccount") ?? "").trim() || null,
    bankName: String(formData.get("bankName") ?? "").trim() || null,
    bankAddress: String(formData.get("bankAddress") ?? "").trim() || null,
    swiftCode: String(formData.get("swiftCode") ?? "").trim() || null,
    paymentInstructions: String(formData.get("paymentInstructions") ?? "").trim() || null,
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

export async function uploadSupplierLogo(supplierId: string, formData: FormData) {
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecione uma imagem de logo para enviar.");
  }

  const extension = file.name.split(".").pop() || "png";
  const path = `${supplierId}-${Date.now()}.${extension}`;
  const { error } = await supabaseAdmin.storage
    .from(LOGOS_BUCKET)
    .upload(path, file, {
      contentType: file.type || "image/png",
      upsert: true,
    });
  if (error) throw new Error(`Falha no upload do logo: ${error.message}`);

  const { data } = supabaseAdmin.storage.from(LOGOS_BUCKET).getPublicUrl(path);

  await db
    .update(suppliers)
    .set({ logoUrl: data.publicUrl, updatedAt: new Date() })
    .where(eq(suppliers.id, supplierId));

  revalidatePath("/fornecedores");
  revalidatePath(`/fornecedores/${supplierId}`);
  revalidatePath("/processos");
  revalidatePath("/");
}
