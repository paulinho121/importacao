"use server";

import { db } from "@/db/client";
import { products, productPriceTiers, productLpcos, productPhotos } from "@/db/schema";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
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
    validUntil: optionalText(formData, "validUntil"),
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

const PHOTO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_UPLOAD_TOTAL = 4 * 1024 * 1024; // limite do corpo da requisição (ver next.config.ts)

// Galeria de fotos do produto (várias): arquivos enviados (PNG/JPEG/WebP, vão
// pro Storage) e/ou links (um por linha), remoção das marcadas e escolha da
// foto principal. products.photo_url acompanha sempre a primeira da galeria.
async function savePhotos(productId: string, formData: FormData) {
  const removeIds = formData.getAll("removePhotoId").map(String).filter((v) => /^[0-9a-f-]{36}$/i.test(v));
  if (removeIds.length > 0) {
    await db.delete(productPhotos).where(and(eq(productPhotos.productId, productId), inArray(productPhotos.id, removeIds)));
  }

  const files = formData.getAll("photoFile").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.reduce((sum, f) => sum + f.size, 0) > MAX_UPLOAD_TOTAL) {
    throw new Error("As fotos enviadas passam de 4 MB no total — envie menos fotos por vez, reduza o tamanho ou use links.");
  }
  const toAdd: string[] = [];
  for (const file of files) {
    const ext = PHOTO_TYPES[file.type];
    if (!ext) throw new Error("As fotos precisam ser PNG, JPEG ou WebP (ou cole links).");
    const path = `produtos/${productId}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await supabaseAdmin.storage.from(LOGOS_BUCKET).upload(path, file, { contentType: file.type });
    if (error) throw new Error(`Falha no upload da foto: ${error.message}`);
    toAdd.push(supabaseAdmin.storage.from(LOGOS_BUCKET).getPublicUrl(path).data.publicUrl);
  }
  for (const line of String(formData.get("photoLinks") ?? "").split(/\r?\n/)) {
    const link = line.trim();
    if (!link) continue;
    if (!/^https?:\/\//i.test(link)) throw new Error("Os links das fotos precisam começar com http:// ou https://.");
    toAdd.push(link);
  }
  if (toAdd.length > 0) {
    await db
      .insert(productPhotos)
      .values(toAdd.map((url, i) => ({ productId, url, position: 1000 + i })))
      .onConflictDoNothing();
  }

  // Reordena: a escolhida como principal vai pra frente; as demais mantêm a ordem.
  const all = await db
    .select({ id: productPhotos.id, url: productPhotos.url })
    .from(productPhotos)
    .where(eq(productPhotos.productId, productId))
    .orderBy(productPhotos.position, productPhotos.createdAt);
  const coverId = String(formData.get("coverPhotoId") ?? "");
  const ordered = [...all.filter((p) => p.id === coverId), ...all.filter((p) => p.id !== coverId)];
  for (const [i, p] of ordered.entries()) {
    await db.update(productPhotos).set({ position: i }).where(eq(productPhotos.id, p.id));
  }
  await db.update(products).set({ photoUrl: ordered[0]?.url ?? null }).where(eq(products.id, productId));
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
  const [created] = await db.insert(products).values(readProductForm(formData)).returning({ id: products.id });
  await savePhotos(created.id, formData);
  revalidatePath("/produtos");
  redirect(withFlash(`/produtos/${created.id}`, "Produto cadastrado."));
}

export async function updateProduct(id: string, formData: FormData) {
  await db
    .update(products)
    .set({ ...readProductForm(formData), updatedAt: new Date() })
    .where(eq(products.id, id));
  await savePhotos(id, formData);
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
    .select({
      id: products.id,
      sku: products.sku,
      manufacturerSku: products.manufacturerSku,
      description: products.description,
    })
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

type LpcoSheetPayload = {
  records: {
    productId: string;
    branch: string;
    status: string;
    lpcoNumber: string | null;
    requestedAt: string | null;
    approvedAt: string | null;
    validUntil: string | null;
    notes: string | null;
  }[];
};

// Importa as linhas da planilha de controle de LPCOs: cada uma vira (ou
// atualiza) uma solicitação do produto no estado. O Nº do LPCO identifica a
// solicitação, então reenviar a mesma planilha atualiza em vez de duplicar.
export async function applyLpcoSheet(payload: LpcoSheetPayload) {
  let inserted = 0;
  let updated = 0;
  const valid = payload.records.filter(
    (r) =>
      /^[0-9a-f-]{36}$/i.test(r.productId) &&
      BRANCHES.some((b) => b.code === r.branch) &&
      PRODUCT_LPCO_STATUSES.some((s) => s.value === r.status),
  );

  await db.transaction(async (tx) => {
    for (const r of valid) {
      const values = {
        branch: r.branch,
        status: r.status,
        requestedAt: r.requestedAt,
        approvedAt: r.approvedAt,
        validUntil: r.validUntil,
        lpcoNumber: r.lpcoNumber,
        notes: r.notes,
      };
      const [existing] = r.lpcoNumber
        ? await tx
            .select({ id: productLpcos.id })
            .from(productLpcos)
            .where(and(eq(productLpcos.productId, r.productId), eq(productLpcos.lpcoNumber, r.lpcoNumber)))
        : [];
      if (existing) {
        await tx.update(productLpcos).set({ ...values, updatedAt: new Date() }).where(eq(productLpcos.id, existing.id));
        updated++;
      } else {
        await tx.insert(productLpcos).values({ productId: r.productId, ...values });
        inserted++;
      }
    }
  });

  revalidatePath("/produtos");
  return { inserted, updated };
}

type IncisoPayloadRecord = {
  model: string;
  manufacturerName: string | null;
  exporterName: string | null;
  ncmAnterior: string | null;
  ncm: string | null;
  longDescription: string | null;
  publicConsultationRef: string | null;
  licenseNumber: string | null;
  licenseRegisteredAt: string | null;
  licenseApprovedAt: string | null;
  licenseStatus: string | null;
  customsBrokerRef: string | null;
};

const LICENSE_STATUSES = ["A_REGISTRAR", "PARA_ANALISE", "EM_CONSULTA_PUBLICA", "EM_EXIGENCIA", "DEFERIDA", "CANCELADA_INDEFERIDA"] as const;
type LicenseStatusValue = (typeof LICENSE_STATUSES)[number];
const asLicenseStatus = (v: string | null): LicenseStatusValue | null =>
  LICENSE_STATUSES.find((s) => s === v) ?? null;

// Importa a base de itens do Inciso V. Nos produtos que já existem só
// PREENCHE o que está vazio (nunca sobrescreve o que foi digitado aqui); os
// itens que não estão no catálogo só são cadastrados se createMissing = true.
// Item deferido com consulta pública informada passa a "Já possui" na CP.
export async function applyIncisoBase(payload: {
  matched: { productId: string; record: IncisoPayloadRecord }[];
  create: IncisoPayloadRecord[];
}) {
  const ids = payload.matched.map((m) => m.productId).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const existing = ids.length ? await db.select().from(products).where(inArray(products.id, ids)) : [];
  const byId = new Map(existing.map((p) => [p.id, p]));
  let updated = 0;
  let created = 0;

  await db.transaction(async (tx) => {
    for (const { productId, record: r } of payload.matched) {
      const p = byId.get(productId);
      if (!p) continue;
      const set: Partial<typeof products.$inferInsert> = {};
      if (!p.ncm && r.ncm) set.ncm = r.ncm;
      if (!p.ncmAnterior && r.ncmAnterior) set.ncmAnterior = r.ncmAnterior;
      if (!p.manufacturerName && r.manufacturerName) set.manufacturerName = r.manufacturerName;
      if (!p.exporterName && r.exporterName) set.exporterName = r.exporterName;
      if (!p.longDescription && r.longDescription) set.longDescription = r.longDescription;
      if (!p.licenseNumber && r.licenseNumber) set.licenseNumber = r.licenseNumber;
      if (!p.licenseRegisteredAt && r.licenseRegisteredAt) set.licenseRegisteredAt = r.licenseRegisteredAt;
      if (!p.licenseApprovedAt && r.licenseApprovedAt) set.licenseApprovedAt = r.licenseApprovedAt;
      if (!p.licenseStatus && asLicenseStatus(r.licenseStatus)) set.licenseStatus = asLicenseStatus(r.licenseStatus);
      if (!p.publicConsultationRef && r.publicConsultationRef) set.publicConsultationRef = r.publicConsultationRef;
      if (!p.customsBrokerRef && r.customsBrokerRef) set.customsBrokerRef = r.customsBrokerRef;
      if (!p.cpStatus && r.licenseStatus === "DEFERIDA" && r.publicConsultationRef) set.cpStatus = "POSSUI";
      if (Object.keys(set).length === 0) continue;
      await tx.update(products).set({ ...set, updatedAt: new Date() }).where(eq(products.id, productId));
      updated++;
    }

    if (payload.create.length > 0) {
      const taken = new Set((await tx.select({ sku: products.sku }).from(products)).map((p) => p.sku.toLowerCase()));
      for (const r of payload.create) {
        const sku = r.model.trim();
        if (!sku || taken.has(sku.toLowerCase())) continue;
        taken.add(sku.toLowerCase());
        await tx.insert(products).values({
          sku,
          manufacturerSku: sku,
          description: sku,
          longDescription: r.longDescription,
          ncm: r.ncm,
          ncmAnterior: r.ncmAnterior,
          manufacturerName: r.manufacturerName,
          exporterName: r.exporterName,
          licenseNumber: r.licenseNumber,
          licenseRegisteredAt: r.licenseRegisteredAt,
          licenseApprovedAt: r.licenseApprovedAt,
          licenseStatus: asLicenseStatus(r.licenseStatus),
          publicConsultationRef: r.publicConsultationRef,
          customsBrokerRef: r.customsBrokerRef,
          cpStatus: r.licenseStatus === "DEFERIDA" && r.publicConsultationRef ? "POSSUI" : null,
        });
        created++;
      }
    }
  });

  revalidatePath("/produtos");
  return { updated, created };
}
