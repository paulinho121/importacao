"use server";

import { db } from "@/db/client";
import {
  processes,
  processItems,
  processEvents,
  products,
  processDocuments,
  processInvoices,
  processLpcos,
  itemReservations,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  STATUS_BY_STEP,
  WORKFLOW_STEPS,
  CUSTOMS_CHANNEL_LABEL,
  type ProcessStatus,
  type CustomsChannel,
} from "@/lib/status";
import { supabaseAdmin, DOCUMENTS_BUCKET } from "@/lib/supabase-admin";
import { fetchVesselPosition } from "@/lib/datalastic";
import { fetchPtaxRate, type PtaxCurrency } from "@/lib/ptax";

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
  const agentId = optionalText(formData, "agentId");

  // Destino: o <select> manda "CODE|Cidade|UF" quando escolhido da lista
  // conhecida (lib/locations.ts) — um único campo, já que um <select> só
  // consegue submeter um valor por name sem JS de cliente. Se vazio/"OUTRO",
  // usa o texto livre do campo "destination" como fallback.
  const locationChoice = optionalText(formData, "locationChoice");
  let destinationCode: string | null = null;
  let destinationCity: string | null = null;
  let destinationState: string | null = null;
  if (locationChoice && locationChoice !== "OUTRO") {
    const [code, city, state] = locationChoice.split("|");
    destinationCode = code ?? null;
    destinationCity = city ?? null;
    destinationState = state ?? null;
  }
  const destinationFreeText = optionalText(formData, "destination");

  const [created] = await db
    .insert(processes)
    .values({
      processNumber,
      supplierId,
      externalReference: optionalText(formData, "externalReference"),
      modal: modal as (typeof processes.$inferInsert)["modal"],
      etd: optionalDate(formData, "etd"),
      etaEstimated: optionalDate(formData, "etaEstimated"),
      agentId,
      destination: destinationFreeText,
      destinationCode,
      destinationCity,
      destinationState,
      weightKg: optionalNumber(formData, "weightKg"),
      volumeM3: optionalNumber(formData, "volumeM3"),
      notes: optionalText(formData, "notes"),
      status: "AGUARDANDO_EMBARQUE",
      currentStep: 1,
    })
    .returning({ id: processes.id });

  // Até 4 invoices no form de criação (como na planilha), sem limite na
  // tabela — mais invoices podem ser adicionados depois na tela de detalhe.
  const invoiceNumbers = ["invoice1", "invoice2", "invoice3", "invoice4"]
    .map((key) => optionalText(formData, key))
    .filter((v): v is string => Boolean(v));
  if (invoiceNumbers.length > 0) {
    await db
      .insert(processInvoices)
      .values(invoiceNumbers.map((invoiceNumber) => ({ processId: created.id, invoiceNumber })));
  }

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

export async function addProcessInvoice(processId: string, formData: FormData) {
  const invoiceNumber = optionalText(formData, "invoiceNumber");
  if (!invoiceNumber) throw new Error("Número da invoice é obrigatório.");

  await db.insert(processInvoices).values({ processId, invoiceNumber });
  revalidatePath(`/processos/${processId}`);
}

export async function updateProcessInvoiceValue(
  invoiceId: string,
  processId: string,
  formData: FormData,
) {
  await db
    .update(processInvoices)
    .set({ value: optionalNumber(formData, "value") })
    .where(eq(processInvoices.id, invoiceId));

  revalidatePath(`/processos/${processId}`);
}

export async function updateProcessFinancials(processId: string, formData: FormData) {
  await db
    .update(processes)
    .set({
      currency: (optionalText(formData, "currency") as (typeof processes.$inferInsert)["currency"]) ?? null,
      incoterm: optionalText(formData, "incoterm"),
      internationalFreightValue: optionalNumber(formData, "internationalFreightValue"),
      insuranceValue: optionalNumber(formData, "insuranceValue"),
      exchangeRateDate: optionalDate(formData, "exchangeRateDate"),
      updatedAt: new Date(),
    })
    .where(eq(processes.id, processId));

  revalidatePath(`/processos/${processId}`);
}

export async function updateCustomsChannel(processId: string, formData: FormData) {
  const channel = optionalText(formData, "customsChannel") as CustomsChannel | null;

  await db
    .update(processes)
    .set({ customsChannel: channel, updatedAt: new Date() })
    .where(eq(processes.id, processId));

  await db.insert(processEvents).values({
    processId,
    eventDate: new Date(),
    eventType: channel
      ? `Canal de parametrização: ${CUSTOMS_CHANNEL_LABEL[channel]}`
      : "Canal de parametrização removido",
  });

  revalidatePath(`/processos/${processId}`);
}

export async function addProcessLpco(processId: string, formData: FormData) {
  const agency = optionalText(formData, "agency") as (typeof processLpcos.$inferInsert)["agency"] | null;
  if (!agency) throw new Error("Órgão anuente é obrigatório.");

  await db.insert(processLpcos).values({
    processId,
    agency,
    lpcoNumber: optionalText(formData, "lpcoNumber"),
    status:
      (optionalText(formData, "status") as (typeof processLpcos.$inferInsert)["status"]) ?? "A_REGISTRAR",
    issuedAt: optionalDate(formData, "issuedAt"),
    validUntil: optionalDate(formData, "validUntil"),
    notes: optionalText(formData, "notes"),
  });

  revalidatePath(`/processos/${processId}`);
}

export async function updateProcessLpco(lpcoId: string, processId: string, formData: FormData) {
  await db
    .update(processLpcos)
    .set({
      lpcoNumber: optionalText(formData, "lpcoNumber"),
      status:
        (optionalText(formData, "status") as (typeof processLpcos.$inferInsert)["status"]) ?? "A_REGISTRAR",
      issuedAt: optionalDate(formData, "issuedAt"),
      validUntil: optionalDate(formData, "validUntil"),
      notes: optionalText(formData, "notes"),
      updatedAt: new Date(),
    })
    .where(eq(processLpcos.id, lpcoId));

  revalidatePath(`/processos/${processId}`);
}

export type FetchExchangeRateState = { error: string } | null;

// Assinatura (state, formData) para useActionState no client component —
// mesmo padrão de refreshVesselPosition: a cotação vem de uma API externa
// (Bacen) que pode não ter dado publicado pra data pedida, e isso precisa
// virar mensagem de erro na UI em vez de derrubar a página.
export async function fetchExchangeRateAction(
  processId: string,
  _prevState: FetchExchangeRateState,
  formData: FormData,
): Promise<FetchExchangeRateState> {
  const currency = optionalText(formData, "currency");
  const date = optionalText(formData, "exchangeRateDate");
  if (!currency || currency === "OTHER") {
    return { error: "Selecione uma moeda com câmbio automático (moeda \"Outra\" exige valor manual)." };
  }
  if (!date) {
    return { error: "Informe a data de referência do câmbio." };
  }

  const result = await fetchPtaxRate({ currency: currency as PtaxCurrency, date });
  if (!result.ok) return { error: result.error };

  await db
    .update(processes)
    .set({
      exchangeRate: String(result.data.rate),
      exchangeRateDate: result.data.date,
      updatedAt: new Date(),
    })
    .where(eq(processes.id, processId));

  revalidatePath(`/processos/${processId}`);
  return null;
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

export async function addItemReservation(processId: string, itemId: string, formData: FormData) {
  const personName = optionalText(formData, "personName");
  const quantity = optionalNumber(formData, "quantity");
  if (!personName) throw new Error("Nome da pessoa é obrigatório.");
  if (!quantity) throw new Error("Quantidade é obrigatória.");

  await db.insert(itemReservations).values({
    itemId,
    personName,
    quantity,
    observation: optionalText(formData, "observation"),
  });

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

export async function updateVesselInfo(processId: string, formData: FormData) {
  await db
    .update(processes)
    .set({
      vesselName: optionalText(formData, "vesselName"),
      vesselImo: optionalText(formData, "vesselImo"),
      vesselMmsi: optionalText(formData, "vesselMmsi"),
      updatedAt: new Date(),
    })
    .where(eq(processes.id, processId));

  revalidatePath(`/processos/${processId}`);
}

export type VesselActionState = { error: string } | null;

// Assinatura (state, formData) para funcionar com useActionState no client
// component — precisamos devolver mensagem de erro pra UI (navio não
// encontrado, key inválida, etc) sem derrubar a página inteira, já que a
// Datalastic é uma API externa que pode falhar por motivos fora do nosso
// controle.
export async function refreshVesselPosition(
  processId: string,
  _prevState: VesselActionState,
  _formData: FormData,
): Promise<VesselActionState> {
  const [process] = await db
    .select({ vesselImo: processes.vesselImo, vesselMmsi: processes.vesselMmsi })
    .from(processes)
    .where(eq(processes.id, processId));
  if (!process) return { error: "Processo não encontrado." };

  const result = await fetchVesselPosition({ imo: process.vesselImo, mmsi: process.vesselMmsi });
  if (!result.ok) return { error: result.error };

  await db
    .update(processes)
    .set({
      vesselLat: String(result.data.lat),
      vesselLon: String(result.data.lon),
      vesselSpeedKnots: result.data.speedKnots !== null ? String(result.data.speedKnots) : null,
      vesselHeading: result.data.heading,
      vesselDestination: result.data.destination,
      vesselPositionUpdatedAt: new Date(),
      ...(result.data.name ? { vesselName: result.data.name } : {}),
      updatedAt: new Date(),
    })
    .where(eq(processes.id, processId));

  await db.insert(processEvents).values({
    processId,
    eventDate: new Date(),
    eventType: "Posição do navio atualizada",
  });

  revalidatePath(`/processos/${processId}`);
  return null;
}
