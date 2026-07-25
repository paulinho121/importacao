"use server";

import { db } from "@/db/client";
import { processes, processItems, processEvents, products, processDocuments } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { STATUS_BY_STEP, WORKFLOW_STEPS, type ProcessStatus } from "@/lib/status";
import { supabaseAdmin, DOCUMENTS_BUCKET } from "@/lib/supabase-admin";

function optionalText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() || null;
}

function optionalDate(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() || null;
}

function optionalNumber(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  return raw ? raw : null;
}

export async function createProcess(formData: FormData) {
  const processNumber = String(formData.get("processNumber") ?? "").trim();
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  if (!processNumber) throw new Error("Número do processo é obrigatório.");
  if (!supplierId) throw new Error("Fornecedor é obrigatório.");

  const modal = optionalText(formData, "modal");

  const [created] = await db
    .insert(processes)
    .values({
      processNumber,
      supplierId,
      externalReference: optionalText(formData, "externalReference"),
      modal: modal as (typeof processes.$inferInsert)["modal"],
      invoiceNumber: optionalText(formData, "invoiceNumber"),
      etd: optionalDate(formData, "etd"),
      etaEstimated: optionalDate(formData, "etaEstimated"),
      agent: optionalText(formData, "agent"),
      destination: optionalText(formData, "destination"),
      weightKg: optionalNumber(formData, "weightKg"),
      volumeM3: optionalNumber(formData, "volumeM3"),
      notes: optionalText(formData, "notes"),
      status: "AGUARDANDO_EMBARQUE",
      currentStep: 1,
    })
    .returning({ id: processes.id });

  await db.insert(processEvents).values({
    processId: created.id,
    eventDate: new Date(),
    eventType: "Processo criado",
    statusAtEvent: "AGUARDANDO_EMBARQUE",
  });

  revalidatePath("/processos");
  revalidatePath("/");
  redirect(`/processos/${created.id}`);
}

export async function advanceProcessStep(processId: string, _formData: FormData) {
  const [current] = await db
    .select({ currentStep: processes.currentStep })
    .from(processes)
    .where(eq(processes.id, processId));
  if (!current) throw new Error("Processo não encontrado.");

  const nextStep = Math.min(current.currentStep + 1, WORKFLOW_STEPS.length);
  const nextStatus = STATUS_BY_STEP[nextStep];

  await db
    .update(processes)
    .set({ currentStep: nextStep, status: nextStatus, updatedAt: new Date() })
    .where(eq(processes.id, processId));

  await db.insert(processEvents).values({
    processId,
    eventDate: new Date(),
    eventType: `Avançou para: ${WORKFLOW_STEPS[nextStep - 1]}`,
    statusAtEvent: nextStatus,
  });

  revalidatePath(`/processos/${processId}`);
  revalidatePath("/processos");
  revalidatePath("/");
}

export async function updateProcessStatus(processId: string, formData: FormData) {
  const status = String(formData.get("status") ?? "").trim() as ProcessStatus;
  if (!status) throw new Error("Status é obrigatório.");

  await db
    .update(processes)
    .set({ status, updatedAt: new Date() })
    .where(eq(processes.id, processId));

  await db.insert(processEvents).values({
    processId,
    eventDate: new Date(),
    eventType: "Status alterado manualmente",
    statusAtEvent: status,
  });

  revalidatePath(`/processos/${processId}`);
  revalidatePath("/processos");
  revalidatePath("/");
}

export async function addProcessItem(processId: string, formData: FormData) {
  const productId = optionalText(formData, "productId");
  const quantity = optionalNumber(formData, "quantity");
  const reservedTo = optionalText(formData, "reservedTo");

  if (productId) {
    const [product] = await db.select().from(products).where(eq(products.id, productId));
    if (!product) throw new Error("Produto não encontrado.");
    await db.insert(processItems).values({
      processId,
      productId,
      sku: product.sku,
      description: product.description,
      quantity,
      reservedTo,
    });
  } else {
    const description = optionalText(formData, "description");
    if (!description) throw new Error("Descrição é obrigatória para item avulso.");
    await db.insert(processItems).values({
      processId,
      sku: optionalText(formData, "sku"),
      description,
      quantity,
      reservedTo,
    });
  }

  revalidatePath(`/processos/${processId}`);
}

export async function uploadProcessDocument(
  processId: string,
  docType: (typeof processDocuments.$inferInsert)["docType"],
  formData: FormData,
) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecione um arquivo para enviar.");
  }

  const path = `${processId}/${docType}-${Date.now()}-${file.name}`;
  const { error } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw new Error(`Falha no upload: ${error.message}`);

  const [existing] = await db
    .select({ id: processDocuments.id })
    .from(processDocuments)
    .where(and(eq(processDocuments.processId, processId), eq(processDocuments.docType, docType)));

  if (existing) {
    await db
      .update(processDocuments)
      .set({ fileName: file.name, storagePath: path, status: "UPLOADED", uploadedAt: new Date() })
      .where(eq(processDocuments.id, existing.id));
  } else {
    await db.insert(processDocuments).values({
      processId,
      docType,
      fileName: file.name,
      storagePath: path,
      status: "UPLOADED",
      uploadedAt: new Date(),
    });
  }

  await db.insert(processEvents).values({
    processId,
    eventDate: new Date(),
    eventType: `Documento enviado: ${docType}`,
  });

  revalidatePath(`/processos/${processId}`);
}
