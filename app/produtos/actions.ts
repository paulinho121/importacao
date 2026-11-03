"use server";

import { db } from "@/db/client";
import { products, productPriceTiers, productLpcos } from "@/db/schema";
import { and, eq, isNull, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withFlash } from "@/lib/flash";
import { BRANCHES } from "@/lib/locations";
import { PRODUCT_LPCO_STATUSES } from "@/lib/lpco";
import { CP_STATUS_OPTIONS } from "@/lib/product-flow";
import { supabaseAdmin, LOGOS_BUCKET } from "@/lib/supabase-admin";

function optionalText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() || null;
}

function optionalNumber(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  return raw ? raw : null;
}

function optionalBool(formData: FormData, key: string): boolean | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "sim") return true;
  if (raw === "nao") return false;
  return null;
}

function readLpcoForm(formData: FormData) {
  const branch = String(formData.get("branch") ?? "").trim();
  if (!BRANCHES.some((b) => b.code === branch)) throw new Error("Escolha a filial da solicitação.");
  const status = String(formData.get("status") ?? "").trim();
  if (!PRODUCT_LPCO_STATUSES.some((s) => s.value === status)) throw new Error("Status do LPCO inválido.");
  const requestedAt = optionalText(formData, "requestedAt");
  const approvedAt = optionalText(formData, "approvedAt");
  if (status === "DEFERIDO" && !approvedAt) throw new Error("Informe a data de deferimento do LPCO.");
  return {
    branch,
    status,
    requestedAt,
    approvedAt,
    lpcoNumber: optionalText(formData, "lpcoNumber"),
    technicalSheet: optionalBool(formData, "technicalSheet"),
    notes: optionalText(formData, "notes"),
  };
}

export async function addProductLpco(productId: string, formData: FormData) {
  await db.insert(productLpcos).values({ productId, ...readLpcoForm(formData) });
  revalidatePath(`/produtos/${productId}`);
  revalidatePath("/produtos");
  redirect(withFlash(`/produtos/${productId}`, "Solicitação de LPCO registrada."));
}

export async function updateProductLpco(lpcoId: string, productId: string, formData: FormData) {
  await db
    .update(productLpcos)
    .set({ ...readLpcoForm(formData), updatedAt: new Date() })
    .where(and(eq(productLpcos.id, lpcoId), eq(productLpcos.productId, productId)));
  revalidatePath(`/produtos/${productId}`);
  revalidatePath("/produtos");
  redirect(withFlash(`/produtos/${productId}`, "Solicitação de LPCO atualizada."));
}

export async function removeProductLpco(lpcoId: string, productId: string) {
  await db.delete(productLpcos).where(and(eq(productLpcos.id, lpcoId), eq(productLpcos.productId, productId)));
  revalidatePath(`/produtos/${productId}`);
  revalidatePath("/produtos");
  redirect(withFlash(`/produtos/${productId}`, "Solicitação de LPCO removida."));
}

// Foto do produto: arquivo enviado (PNG/JPEG/WebP, vai pro Storage) ou link
// externo. Devolve só o que mudou — {} deixa a foto atual como está.
async function resolvePhoto(formData: FormData): Promise<{ photoUrl?: string | null }> {
  const file = formData.get("photoFile");
  if (file instanceof File && file.size > 0) {
    const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[file.type];
    if (!ext) throw new Error("A foto precisa ser PNG, JPEG ou WebP (ou cole um link).");
    if (file.size > 4 * 1024 * 1024) throw new Error("A foto passa de 4 MB — reduza o tamanho ou use um link.");
    const path = `produtos/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseAdmin.storage.from(LOGOS_BUCKET).upload(path, file, { contentType: file.type });
    if (error) throw new Error(`Falha no upload da foto: ${error.message}`);
    return { photoUrl: supabaseAdmin.storage.from(LOGOS_BUCKET).getPublicUrl(path).data.publicUrl };
  }
  const link = optionalText(formData, "photoUrl");
  if (link) {
    if (!/^https?:\/\//i.test(link)) throw new Error("O link da foto precisa começar com http:// ou https://.");
    return { photoUrl: link };
  }
  if (formData.get("removePhoto") === "on") return { photoUrl: null };
  return {};
}

function readProductForm(formData: FormData) {
  const sku = String(formData.get("sku") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!sku) throw new Error("SKU interno é obrigatório.");
  if (!description) throw new Error("Nome do produto é obrigatório.");
  return {
    sku,
    description,
    manufacturerSku: optionalText(formData, "manufacturerSku"),
    longDescription: optionalText(formData, "longDescription"),
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
    publicConsultationDate: optionalText(formData, "publicConsultationDate"),
    cpStatus: (() => {
      const v = optionalText(formData, "cpStatus");
      return v && CP_STATUS_OPTIONS.some((o) => o.value === v) ? v : null;
    })(),
    cpRequestedAt: optionalText(formData, "cpRequestedAt"),
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
  const values = { ...readProductForm(formData), ...(await resolvePhoto(formData)) };
  const [created] = await db.insert(products).values(values).returning({ id: products.id });
  revalidatePath("/produtos");
  redirect(withFlash(`/produtos/${created.id}`, "Produto cadastrado."));
}

export async function updateProduct(id: string, formData: FormData) {
  const values = { ...readProductForm(formData), ...(await resolvePhoto(formData)) };
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

// ---- Varredura da lista pública do governo (ver lib/cp-list.ts) -----------

// Catálogo enxuto que o navegador usa pra conferir a planilha localmente.
export async function getProductsForCpList() {
  return db
    .select({ id: products.id, sku: products.sku, manufacturerSku: products.manufacturerSku })
    .from(products);
}

type CpListPayload = {
  source: string;
  listDate: string | null;
  matches: { productId: string; result: "FOUND" | "FOUND_NATIONAL" | "FOUND_APPROX"; ref: string; ncm: string | null }[];
};

// Grava o resultado da conferência: todo produto é marcado como conferido
// (NOT_FOUND por padrão) e os que aparecem na lista recebem o resultado, a(s)
// CP(s) e a NCM da lista. Quem consta como deferido (FOUND) passa a ter
// "Status da CP = Já possui" e, se estava vazia, a Ref. Consulta Pública.
export async function applyCpListResults(payload: CpListPayload) {
  const now = new Date();
  const source = payload.listDate ? `${payload.source} (atualizada em ${payload.listDate})` : payload.source;
  const validMatches = payload.matches.filter((m) => /^[0-9a-f-]{36}$/i.test(m.productId));

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ cpListResult: "NOT_FOUND", cpListRef: null, cpListNcm: null, cpListCheckedAt: now, cpListSource: source });

    for (const m of validMatches) {
      await tx
        .update(products)
        .set({
          cpListResult: m.result,
          cpListRef: m.ref || null,
          cpListNcm: m.ncm,
          ...(m.result === "FOUND" ? { hasPublicConsultation: true, cpStatus: "POSSUI" } : {}),
        })
        .where(eq(products.id, m.productId));
      if (m.result === "FOUND" && m.ref) {
        await tx
          .update(products)
          .set({ publicConsultationRef: `Consulta Pública nº ${m.ref.split(", ")[0]}` })
          .where(and(eq(products.id, m.productId), or(isNull(products.publicConsultationRef), eq(products.publicConsultationRef, ""))));
      }
    }
  });

  revalidatePath("/produtos");
  return {
    found: validMatches.filter((m) => m.result === "FOUND").length,
    foundNational: validMatches.filter((m) => m.result === "FOUND_NATIONAL").length,
    foundApprox: validMatches.filter((m) => m.result === "FOUND_APPROX").length,
  };
}
