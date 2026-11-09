"use server";

import { modalFromTipo, modalidadeFromModal } from "@/lib/modais";
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
  purchaseOrders,
} from "@/db/schema";
import { LinkError, linkPurchaseOrderToProcess, unlinkPurchaseOrderFromProcess } from "@/lib/process-purchase-orders";
import { isUniqueViolation } from "@/lib/db-errors";
import { and, eq, ilike, ne, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withFlash, withFlashError } from "@/lib/flash";
import { normalizeDriveUrl } from "@/lib/drive-links";
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
import { getCurrentUser } from "@/lib/supabase-server";

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

// Campo sim/não de <select> ("sim" | "nao" | vazio = não informado).
function optionalBool(formData: FormData, key: string): boolean | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "sim") return true;
  if (raw === "nao") return false;
  return null;
}

// A invoice do item precisa ser do mesmo processo.
async function validInvoiceId(processId: string, invoiceId: string | null) {
  if (!invoiceId) return null;
  const [inv] = await db
    .select({ id: processInvoices.id })
    .from(processInvoices)
    .where(and(eq(processInvoices.id, invoiceId), eq(processInvoices.processId, processId)));
  if (!inv) throw new Error("Invoice não pertence a este processo.");
  return inv.id;
}

// Modal estruturado (enum) a partir do tipo de embarque escolhido; sem tipo,
// só mantém o modal atual se ele ainda pertence à modalidade escolhida.
function resolveModal(formData: FormData, currentModal: string | null) {
  const tipo = optionalText(formData, "containerType");
  const modalidade = optionalText(formData, "modalidade");
  const fromTipo = modalFromTipo(tipo);
  if (fromTipo) return fromTipo;
  if (modalidade && modalidadeFromModal(currentModal) === modalidade) return currentModal;
  return null;
}

// Tela "Novo Processo": ou cria um processo novo, ou (escolhendo um existente
// na lista do campo Número do Processo) só coloca pedidos de compra nele. Em
// ambos os casos os pedidos marcados entram no processo, e os fornecedores do
// processo vêm deles.
export async function createProcess(formData: FormData) {
  const poIds = [
    ...new Set(
      formData
        .getAll("purchaseOrderId")
        .map((v) => String(v).trim())
        .filter(Boolean),
    ),
  ];
  const existingProcessId = optionalText(formData, "existingProcessId");

  if (existingProcessId) {
    if (poIds.length === 0) {
      redirect(withFlashError("/processos/novo", "Escolha ao menos um pedido de compra para colocar no processo."));
    }
    let linkError: string | null = null;
    try {
      await db.transaction(async (tx) => {
        for (const poId of poIds) await linkPurchaseOrderToProcess(tx, poId, existingProcessId);
      });
    } catch (e) {
      if (e instanceof LinkError) linkError = e.message;
      else throw e;
    }
    if (linkError) redirect(withFlashError("/processos/novo", linkError));
    revalidatePath(`/processos/${existingProcessId}`);
    revalidatePath("/processos");
    revalidatePath("/pedidos-compra");
    redirect(
      withFlash(`/processos/${existingProcessId}`, `${poIds.length} ${poIds.length === 1 ? "pedido adicionado" : "pedidos adicionados"} ao processo.`),
    );
  }

  const processNumber = String(formData.get("processNumber") ?? "").trim();
  if (!processNumber) throw new Error("Número do processo é obrigatório.");

  // As duas leituras iniciais são independentes: saem juntas (1 ida em vez de 2).
  const duplicateMessage = `Já existe um processo com o número "${processNumber}". Escolha-o na lista para adicionar pedidos, ou use outro número.`;
  const [[sameNumber], firstPoRows] = await Promise.all([
    db.select({ id: processes.id }).from(processes).where(eq(processes.processNumber, processNumber)),
    poIds.length > 0
      ? db.select({ supplierId: purchaseOrders.supplierId }).from(purchaseOrders).where(eq(purchaseOrders.id, poIds[0]))
      : Promise.resolve([] as { supplierId: string }[]),
  ]);
  if (sameNumber) redirect(withFlashError("/processos/novo", duplicateMessage));

  // O fornecedor principal vem do primeiro pedido escolhido; sem pedidos, do campo.
  let supplierId = String(formData.get("supplierId") ?? "").trim();
  if (firstPoRows[0]) supplierId = firstPoRows[0].supplierId;
  if (!supplierId) {
    redirect(withFlashError("/processos/novo", "Escolha o fornecedor ou adicione um pedido de compra."));
  }

  const modal = resolveModal(formData, null);
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

  // Até 4 invoices no form de criação (como na planilha), sem limite na
  // tabela — mais invoices podem ser adicionados depois na tela de detalhe.
  const invoiceNumbers = ["invoice1", "invoice2", "invoice3", "invoice4"]
    .map((key) => optionalText(formData, key))
    .filter((v): v is string => Boolean(v));

  // Processo, invoices e pedidos vinculados numa transação só: se um pedido
  // não puder entrar (já está em outro processo, cancelado…), nada é criado.
  let createdId: string | null = null;
  let linkError: string | null = null;
  try {
    createdId = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(processes)
        .values({
          processNumber,
          supplierId,
          externalReference: optionalText(formData, "externalReference"),
          modal: modal as (typeof processes.$inferInsert)["modal"],
          containerType: optionalText(formData, "containerType"),
          etd: optionalDate(formData, "etd"),
          etaEstimated: optionalDate(formData, "etaEstimated"),
          agentId,
          destination: destinationFreeText,
          destinationCode,
          destinationCity,
          destinationState,
          destinationBranch: optionalText(formData, "destinationBranch"),
          weightKg: optionalNumber(formData, "weightKg"),
          volumeM3: optionalNumber(formData, "volumeM3"),
          notes: optionalText(formData, "notes"),
          status: "AGUARDANDO_EMBARQUE",
          currentStep: 1,
        })
        .returning({ id: processes.id });

      if (invoiceNumbers.length > 0) {
        await tx
          .insert(processInvoices)
          .values(invoiceNumbers.map((invoiceNumber) => ({ processId: created.id, invoiceNumber })));
      }

      await tx.insert(processEvents).values({
        processId: created.id,
        eventDate: new Date(),
        eventType: "Processo criado",
        statusAtEvent: "AGUARDANDO_EMBARQUE",
      });

      for (const poId of poIds) await linkPurchaseOrderToProcess(tx, poId, created.id);
      return created.id;
    });
  } catch (e) {
    if (e instanceof LinkError) linkError = e.message;
    // duas pessoas criando o mesmo número ao mesmo tempo: a restrição única do banco decide
    else if (isUniqueViolation(e)) linkError = duplicateMessage;
    else throw e;
  }
  if (linkError || !createdId) redirect(withFlashError("/processos/novo", linkError ?? "Não foi possível criar o processo."));

  revalidatePath("/processos");
  revalidatePath("/pedidos-compra");
  revalidatePath("/");
  redirect(withFlash(`/processos/${createdId}`, poIds.length > 0 ? `Processo criado com ${poIds.length} ${poIds.length === 1 ? "pedido" : "pedidos"}.` : "Processo criado."));
}

export async function updateProcessNumber(processId: string, formData: FormData) {
  const processNumber = String(formData.get("processNumber") ?? "").trim();
  if (!processNumber) throw new Error("Número do processo é obrigatório.");

  const [existing] = await db
    .select({ id: processes.id })
    .from(processes)
    .where(and(eq(processes.processNumber, processNumber), ne(processes.id, processId)));
  if (existing) {
    throw new Error(`Já existe outro processo com o número "${processNumber}" — use um número diferente.`);
  }

  await db
    .update(processes)
    .set({ processNumber, updatedAt: new Date() })
    .where(eq(processes.id, processId));

  await db.insert(processEvents).values({
    processId,
    eventDate: new Date(),
    eventType: `Número do processo alterado para ${processNumber}`,
  });

  revalidatePath(`/processos/${processId}`);
  revalidatePath("/processos");
  revalidatePath("/");
}

export async function addProcessInvoice(processId: string, formData: FormData) {
  const invoiceNumber = optionalText(formData, "invoiceNumber");
  if (!invoiceNumber) throw new Error("Número da invoice é obrigatório.");

  // Opcional — vazio = invoice do fornecedor do próprio processo.
  const supplierId = optionalText(formData, "supplierId");

  const drive = normalizeDriveUrl(optionalText(formData, "driveUrl"));
  if (!drive.ok) redirect(withFlashError(`/processos/${processId}`, drive.error));

  await db.insert(processInvoices).values({ processId, invoiceNumber, supplierId, driveUrl: drive.url });
  revalidatePath(`/processos/${processId}`);
}

// Link do Google Drive com o arquivo da invoice (vazio = remove o link).
export async function updateProcessInvoiceLink(invoiceId: string, processId: string, formData: FormData) {
  const back = `/processos/${processId}`;
  const drive = normalizeDriveUrl(optionalText(formData, "driveUrl"));
  if (!drive.ok) redirect(withFlashError(back, drive.error));

  await db
    .update(processInvoices)
    .set({ driveUrl: drive.url })
    .where(and(eq(processInvoices.id, invoiceId), eq(processInvoices.processId, processId)));

  revalidatePath(back);
  redirect(withFlash(back, drive.url ? "Link da invoice salvo." : "Link da invoice removido."));
}

// Dados de embarque que a planilha do time acompanhava em colunas soltas
// (Tipo de Embarque, Referência do Agente, Rastreio, Fechamento, DUIMP).
export async function updateShipmentInfo(processId: string, formData: FormData) {
  const trackingUrl = optionalText(formData, "trackingUrl");
  if (trackingUrl && !/^https?:\/\//i.test(trackingUrl)) {
    throw new Error("O link de rastreio precisa começar com http:// ou https://.");
  }

  await db
    .update(processes)
    .set({
      externalReference: optionalText(formData, "externalReference"),
      trackingNumber: optionalText(formData, "trackingNumber"),
      trackingUrl,
      closedAt: optionalDate(formData, "closedAt"),
      customsDeclarationNumber: optionalText(formData, "customsDeclarationNumber"),
      updatedAt: new Date(),
    })
    .where(eq(processes.id, processId));

  revalidatePath(`/processos/${processId}`);
  revalidatePath("/processos");
  redirect(withFlash(`/processos/${processId}`, "Dados do embarque salvos."));
}

// Follow-up: andamento digitado à mão (substitui as colunas de texto solto
// da planilha). Gravado em process_events com origin "Manual · nome" — é
// essa marca que libera a exclusão (eventos automáticos de status/etapa
// não podem ser apagados por aqui). Data guardada ao meio-dia UTC pra o
// dia não "virar" ao exibir no fuso do Brasil.
export async function addProcessFollowUp(processId: string, formData: FormData) {
  const text = optionalText(formData, "text");
  if (!text) throw new Error("Descreva o andamento antes de registrar.");

  const date = optionalDate(formData, "date");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Data inválida.");

  const user = await getCurrentUser();
  const author = user?.name || user?.email || "usuário";

  await db.insert(processEvents).values({
    processId,
    eventDate: date ? new Date(`${date}T12:00:00Z`) : new Date(),
    eventType: text,
    origin: `Manual · ${author}`,
  });

  revalidatePath(`/processos/${processId}`);
  redirect(withFlash(`/processos/${processId}`, "Andamento registrado."));
}

export async function removeProcessFollowUp(eventId: string, processId: string) {
  const [ev] = await db
    .select({ origin: processEvents.origin })
    .from(processEvents)
    .where(and(eq(processEvents.id, eventId), eq(processEvents.processId, processId)));
  if (!ev?.origin?.startsWith("Manual")) {
    throw new Error("Só é possível remover andamentos registrados manualmente.");
  }

  await db.delete(processEvents).where(eq(processEvents.id, eventId));

  revalidatePath(`/processos/${processId}`);
  redirect(withFlash(`/processos/${processId}`, "Andamento removido."));
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

// Encerra o processo imediatamente (fora da progressão normal do
// workflow) — pedido cancelado pelo fornecedor, desistência, etc. Motivo é
// opcional, mas fica registrado no evento pra dar contexto depois.
export async function abandonProcess(processId: string, formData: FormData) {
  const reason = String(formData.get("reason") ?? "").trim();

  await db
    .update(processes)
    .set({ status: "ABANDONADO", updatedAt: new Date() })
    .where(eq(processes.id, processId));

  await db.insert(processEvents).values({
    processId,
    eventDate: new Date(),
    eventType: reason ? `Processo abandonado: ${reason}` : "Processo abandonado",
    statusAtEvent: "ABANDONADO",
  });

  revalidatePath(`/processos/${processId}`);
  revalidatePath("/processos");
  revalidatePath("/");
  redirect(withFlash(`/processos/${processId}`, "Processo abandonado."));
}

export async function addProcessItem(processId: string, formData: FormData) {
  const productId = optionalText(formData, "productId");
  const quantity = optionalNumber(formData, "quantity");
  const reservedTo = optionalText(formData, "reservedTo");
  const itemFields = {
    invoiceId: await validInvoiceId(processId, optionalText(formData, "invoiceId")),
    exchangeCoverage: optionalBool(formData, "exchangeCoverage"),
    unitValueOverride: optionalNumber(formData, "unitValueOverride"),
    lpcoPublicConsultation: optionalBool(formData, "lpcoPublicConsultation"),
    lpcoNumber: optionalText(formData, "lpcoNumber"),
  };

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
      ...itemFields,
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
      ...itemFields,
    });
  }

  revalidatePath(`/processos/${processId}`);
  redirect(withFlash(`/processos/${processId}`, "Item adicionado."));
}

// Busca do catálogo ao adicionar item: cada palavra digitada precisa
// aparecer no SKU, no SKU do fabricante (System Code) ou na descrição
// (nome) — ex: "ray 660" acha "amaran Ray 660c (US)". Sob demanda, em vez
// de mandar o catálogo inteiro (585+ produtos) pra tela.
export async function searchProductsForProcess(query: string) {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .map((t) => `%${t.replace(/[\\%_]/g, "\\$&")}%`);

  return db
    .select({
      id: products.id,
      sku: products.sku,
      manufacturerSku: products.manufacturerSku,
      description: products.description,
      licenseStatus: products.licenseStatus,
      licenseNumber: products.licenseNumber,
    })
    .from(products)
    .where(
      tokens.length
        ? and(
            ...tokens.map((t) =>
              or(ilike(products.sku, t), ilike(products.manufacturerSku, t), ilike(products.description, t)),
            ),
          )
        : undefined,
    )
    .orderBy(products.sku)
    .limit(40);
}

// Edição dos dados básicos do processo (modal, datas, agente, destino,
// peso/volume, observações) — antes só dava pra definir isso na criação.
export async function updateProcessDetails(processId: string, formData: FormData) {
  // Mesmo contrato do createProcess: o <select> manda "CODE|Cidade|UF" pra
  // destino conhecido (lib/locations.ts); vazio/"OUTRO" usa o texto livre.
  const locationChoice = optionalText(formData, "locationChoice");
  const known = locationChoice && locationChoice !== "OUTRO";
  const [code, city, state] = known ? locationChoice.split("|") : [null, null, null];
  const [current] = await db
    .select({ modal: processes.modal })
    .from(processes)
    .where(eq(processes.id, processId));

  await db
    .update(processes)
    .set({
      modal: resolveModal(formData, current?.modal ?? null) as (typeof processes.$inferInsert)["modal"],
      containerType: optionalText(formData, "containerType"),
      agentId: optionalText(formData, "agentId"),
      etd: optionalDate(formData, "etd"),
      etaEstimated: optionalDate(formData, "etaEstimated"),
      etaActual: optionalDate(formData, "etaActual"),
      destination: known ? null : optionalText(formData, "destination"),
      destinationCode: code ?? null,
      destinationCity: city ?? null,
      destinationState: state ?? null,
      destinationBranch: optionalText(formData, "destinationBranch"),
      weightKg: optionalNumber(formData, "weightKg"),
      volumeM3: optionalNumber(formData, "volumeM3"),
      notes: optionalText(formData, "notes"),
      updatedAt: new Date(),
    })
    .where(eq(processes.id, processId));

  revalidatePath(`/processos/${processId}`);
  revalidatePath("/processos");
  revalidatePath("/");
  redirect(withFlash(`/processos/${processId}`, "Dados do processo atualizados."));
}

// Quantidade e reserva (texto legado) sempre editáveis; descrição/SKU só
// nos itens avulsos — nos do catálogo vêm do cadastro do produto.
export async function updateProcessItem(itemId: string, processId: string, formData: FormData) {
  const [item] = await db
    .select({ productId: processItems.productId })
    .from(processItems)
    .where(and(eq(processItems.id, itemId), eq(processItems.processId, processId)));
  if (!item) throw new Error("Item não encontrado.");

  const values: Partial<typeof processItems.$inferInsert> = {
    quantity: optionalNumber(formData, "quantity"),
    reservedTo: optionalText(formData, "reservedTo"),
    invoiceId: await validInvoiceId(processId, optionalText(formData, "invoiceId")),
    exchangeCoverage: optionalBool(formData, "exchangeCoverage"),
    lpcoPublicConsultation: optionalBool(formData, "lpcoPublicConsultation"),
    lpcoNumber: optionalText(formData, "lpcoNumber"),
  };
  if (!item.productId) {
    const description = optionalText(formData, "description");
    if (!description) throw new Error("Descrição é obrigatória.");
    values.description = description;
    values.sku = optionalText(formData, "sku");
  }

  await db.update(processItems).set(values).where(eq(processItems.id, itemId));

  revalidatePath(`/processos/${processId}`);
  redirect(withFlash(`/processos/${processId}`, "Item atualizado."));
}

// As reservas do item saem junto (FK com cascade).
export async function removeProcessItem(itemId: string, processId: string) {
  await db
    .delete(processItems)
    .where(and(eq(processItems.id, itemId), eq(processItems.processId, processId)));

  revalidatePath(`/processos/${processId}`);
  redirect(withFlash(`/processos/${processId}`, "Item removido."));
}

// Valor unitário manual pra ratear custo pousado/imposto — só precisa ser
// preenchido quando o item é avulso ou o costPrice do catálogo não serve
// pra esta compra (ver lib/landed-cost.ts).
export async function updateProcessItemValue(itemId: string, processId: string, formData: FormData) {
  await db
    .update(processItems)
    .set({ unitValueOverride: optionalNumber(formData, "unitValueOverride") })
    .where(eq(processItems.id, itemId));

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
      .set({ fileName: file.name, storagePath: path, status: "UPLOADED", uploadedAt: new Date(), purchaseOrderId: null })
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

// ---- Pedidos de compra dentro do processo (um processo = vários pedidos) ----

export async function addPurchaseOrderToProcess(processId: string, formData: FormData) {
  const poId = String(formData.get("purchaseOrderId") ?? "").trim();
  if (!poId) throw new Error("Escolha o pedido de compra.");
  let itemCount = 0;
  try {
    ({ itemCount } = await db.transaction((tx) => linkPurchaseOrderToProcess(tx, poId, processId)));
  } catch (e) {
    if (e instanceof LinkError) throw new Error(e.message);
    throw e;
  }
  revalidatePath(`/processos/${processId}`);
  revalidatePath("/processos");
  revalidatePath("/pedidos-compra");
  revalidatePath(`/pedidos-compra/${poId}`);
  redirect(withFlash(`/processos/${processId}`, `Pedido adicionado ao processo (${itemCount} ${itemCount === 1 ? "item" : "itens"}).`));
}

export async function removePurchaseOrderFromProcess(processId: string, poId: string) {
  try {
    await db.transaction((tx) => unlinkPurchaseOrderFromProcess(tx, poId, processId));
  } catch (e) {
    if (e instanceof LinkError) throw new Error(e.message);
    throw e;
  }
  revalidatePath(`/processos/${processId}`);
  revalidatePath("/processos");
  revalidatePath("/pedidos-compra");
  revalidatePath(`/pedidos-compra/${poId}`);
  redirect(withFlash(`/processos/${processId}`, "Pedido removido do processo."));
}
