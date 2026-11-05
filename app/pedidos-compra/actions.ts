"use server";

import { db } from "@/db/client";
import {
  purchaseOrders,
  purchaseOrderItems,
  purchaseOrderDocuments,
  processDocuments,
  products,
  processes,
  processItems,
  productPriceTiers,
} from "@/db/schema";
import { and, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase-server";
import { withFlash, withFlashError } from "@/lib/flash";
import { LinkError, linkPurchaseOrderToProcess, syncPackingListToProcess } from "@/lib/process-purchase-orders";
import { logPurchaseOrderEvent } from "@/lib/purchase-order-events";
import { PURCHASE_ORDER_STATUS_LABEL, type PurchaseOrderStatus } from "@/lib/status";
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

function brDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function showValue(v: string | null | undefined) {
  return v && v.trim() ? v : "—";
}

export async function createPurchaseOrder(formData: FormData) {
  const poNumber = String(formData.get("poNumber") ?? "").trim();
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  if (!poNumber) throw new Error("Número do pedido é obrigatório.");
  if (!supplierId) throw new Error("Fornecedor é obrigatório.");

  const [duplicate] = await db.select({ id: purchaseOrders.id }).from(purchaseOrders).where(eq(purchaseOrders.poNumber, poNumber));
  if (duplicate) {
    redirect(withFlashError("/pedidos-compra/novo", `Já existe um pedido com o número "${poNumber}" — use um número diferente.`));
  }

  const user = await getCurrentUser();

  const [created] = await db
    .insert(purchaseOrders)
    .values({
      poNumber,
      supplierId,
      branchId: optionalText(formData, "branchId"),
      currency: optionalText(formData, "currency") as (typeof purchaseOrders.$inferInsert)["currency"] | null,
      incoterm: optionalText(formData, "incoterm"),
      paymentTerms: optionalText(formData, "paymentTerms"),
      expectedDeliveryDate: optionalDate(formData, "expectedDeliveryDate"),
      notes: optionalText(formData, "notes"),
      createdByUserId: user?.id ?? null,
    })
    .returning({ id: purchaseOrders.id });

  await logPurchaseOrderEvent(db, created.id, "CRIADO", `Pedido ${poNumber} criado`);

  revalidatePath("/pedidos-compra");
  redirect(withFlash(`/pedidos-compra/${created.id}`, "Pedido de compra criado."));
}

// Edita os dados do pedido em qualquer status, menos Cancelado. Cada campo
// alterado entra no histórico ("Moeda: USD → EUR").
export async function updatePurchaseOrder(poId: string, formData: FormData) {
  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!po) throw new Error("Pedido de compra não encontrado.");
  if (po.status === "CANCELADO") {
    redirect(withFlashError(`/pedidos-compra/${poId}`, "Pedido cancelado não pode ser editado."));
  }

  const poNumber = String(formData.get("poNumber") ?? "").trim();
  if (!poNumber) throw new Error("Número do pedido é obrigatório.");

  const [existing] = await db.select({ id: purchaseOrders.id }).from(purchaseOrders).where(eq(purchaseOrders.poNumber, poNumber));
  if (existing && existing.id !== poId) {
    redirect(withFlashError(`/pedidos-compra/${poId}`, `Já existe um pedido com o número "${poNumber}" — use um número diferente.`));
  }

  const next = {
    poNumber,
    branchId: optionalText(formData, "branchId"),
    currency: optionalText(formData, "currency") as (typeof purchaseOrders.$inferInsert)["currency"] | null,
    incoterm: optionalText(formData, "incoterm"),
    paymentTerms: optionalText(formData, "paymentTerms"),
    expectedDeliveryDate: optionalDate(formData, "expectedDeliveryDate"),
    notes: optionalText(formData, "notes"),
  };

  const changes: string[] = [];
  if (next.poNumber !== po.poNumber) changes.push(`Número: ${po.poNumber} → ${next.poNumber}`);
  if (next.branchId !== po.branchId) changes.push("Comprador alterado");
  if (next.currency !== po.currency) changes.push(`Moeda: ${showValue(po.currency)} → ${showValue(next.currency)}`);
  if (next.incoterm !== po.incoterm) changes.push(`Incoterm: ${showValue(po.incoterm)} → ${showValue(next.incoterm)}`);
  if (next.paymentTerms !== po.paymentTerms) {
    changes.push(`Payment Terms: ${showValue(po.paymentTerms)} → ${showValue(next.paymentTerms)}`);
  }
  if (next.expectedDeliveryDate !== po.expectedDeliveryDate) {
    changes.push(`Entrega prevista: ${brDate(po.expectedDeliveryDate)} → ${brDate(next.expectedDeliveryDate)}`);
  }
  if (next.notes !== po.notes) changes.push("Observações alteradas");

  await db
    .update(purchaseOrders)
    .set({ ...next, updatedAt: new Date() })
    .where(eq(purchaseOrders.id, poId));

  if (changes.length > 0) await logPurchaseOrderEvent(db, poId, "EDITADO", changes.join(" · "));

  revalidatePath("/pedidos-compra");
  // o redirect recarrega a página com o formulário de edição fechado e mostra o aviso
  redirect(withFlash(`/pedidos-compra/${poId}`, changes.length > 0 ? "Pedido atualizado." : "Nada foi alterado."));
}

export async function deletePurchaseOrder(poId: string) {
  const [po] = await db.select({ status: purchaseOrders.status, processId: purchaseOrders.processId }).from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!po) throw new Error("Pedido de compra não encontrado.");
  if (po.status === "CONFIRMADO" || po.processId) {
    throw new Error("Só é possível excluir pedidos que ainda não foram confirmados pelo fornecedor.");
  }

  await db.delete(purchaseOrders).where(eq(purchaseOrders.id, poId));

  revalidatePath("/pedidos-compra");
  redirect(withFlash("/pedidos-compra", "Pedido excluído."));
}

// Busca sob demanda (em vez de mandar o catalogo inteiro do fornecedor pro
// cliente): AddPurchaseOrderItemForm chama isso a cada digitacao (com
// debounce), evitando serializar centenas de produtos como prop toda vez
// que a pagina do pedido revalida.
export async function searchPurchaseOrderProducts(supplierId: string, query: string) {
  const q = query.trim();

  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      manufacturerSku: products.manufacturerSku,
      description: products.description,
      costPrice: products.costPrice,
      manufacturerName: products.manufacturerName,
      noSupplier: sql<boolean>`${products.defaultSupplierId} is null`.mapWith(Boolean),
    })
    .from(products)
    .where(
      q
        ? and(
            // produtos do fornecedor do pedido + os que ainda não têm
            // fornecedor padrão (senão ficariam impossíveis de pedir)
            or(eq(products.defaultSupplierId, supplierId), isNull(products.defaultSupplierId)),
            // o código do fabricante (ex.: AP0701051U) costuma ser o que vem na
            // invoice, então também vale na busca
            or(
              ilike(products.sku, `%${q}%`),
              ilike(products.manufacturerSku, `%${q}%`),
              ilike(products.description, `%${q}%`),
            ),
          )
        : or(eq(products.defaultSupplierId, supplierId), isNull(products.defaultSupplierId)),
    )
    // os do próprio fornecedor primeiro
    .orderBy(sql`(${products.defaultSupplierId} is null)`, products.sku)
    .limit(50);

  if (rows.length === 0) return rows.map((r) => ({ ...r, priceTiers: [] as { minQuantity: string; price: string }[] }));

  const tierRows = await db
    .select({ productId: productPriceTiers.productId, minQuantity: productPriceTiers.minQuantity, price: productPriceTiers.price })
    .from(productPriceTiers)
    .where(inArray(productPriceTiers.productId, rows.map((r) => r.id)));

  const tiersByProduct = new Map<string, { minQuantity: string; price: string }[]>();
  for (const t of tierRows) {
    const list = tiersByProduct.get(t.productId) ?? [];
    list.push({ minQuantity: t.minQuantity, price: t.price });
    tiersByProduct.set(t.productId, list);
  }

  return rows.map((r) => ({ ...r, priceTiers: tiersByProduct.get(r.id) ?? [] }));
}

export async function addPurchaseOrderItem(poId: string, formData: FormData) {
  const productId = optionalText(formData, "productId");
  const quantity = optionalNumber(formData, "quantity");
  const unitPrice = optionalNumber(formData, "unitPrice");

  const [po] = await db
    .select({ status: purchaseOrders.status, processId: purchaseOrders.processId })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, poId));
  if (!po) throw new Error("Pedido de compra não encontrado.");
  if (po.status === "CANCELADO") {
    redirect(withFlashError(`/pedidos-compra/${poId}`, "Pedido cancelado não pode ser alterado."));
  }
  if (po.processId) {
    redirect(withFlashError(`/pedidos-compra/${poId}`, "Este pedido já está em um processo. Remova-o do processo para alterar os itens."));
  }

  if (productId) {
    const [product] = await db.select().from(products).where(eq(products.id, productId));
    if (!product) throw new Error("Produto não encontrado.");
    await db.insert(purchaseOrderItems).values({
      purchaseOrderId: poId,
      productId,
      sku: product.sku,
      description: product.description,
      quantity,
      unitPrice,
    });
    await logPurchaseOrderEvent(db, poId, "ITEM_ADICIONADO", `${product.sku} — ${product.description} · qtd ${quantity ?? "—"} · preço ${unitPrice ?? "—"}`);
  } else {
    const description = optionalText(formData, "description");
    if (!description) throw new Error("Descrição é obrigatória para item avulso.");
    await db.insert(purchaseOrderItems).values({
      purchaseOrderId: poId,
      sku: optionalText(formData, "sku"),
      description,
      quantity,
      unitPrice,
    });
    await logPurchaseOrderEvent(db, poId, "ITEM_ADICIONADO", `${description} · qtd ${quantity ?? "—"} · preço ${unitPrice ?? "—"}`);
  }

  revalidatePath(`/pedidos-compra/${poId}`);
}

// Altera quantidade e preço de um item (pedido ainda fora de processo).
export async function updatePurchaseOrderItem(itemId: string, poId: string, formData: FormData) {
  const [po] = await db
    .select({ status: purchaseOrders.status, processId: purchaseOrders.processId })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, poId));
  if (!po) throw new Error("Pedido de compra não encontrado.");
  if (po.status === "CANCELADO") {
    redirect(withFlashError(`/pedidos-compra/${poId}`, "Pedido cancelado não pode ser alterado."));
  }
  if (po.processId) {
    redirect(withFlashError(`/pedidos-compra/${poId}`, "Este pedido já está em um processo. Remova-o do processo para alterar os itens."));
  }

  const [item] = await db
    .select()
    .from(purchaseOrderItems)
    .where(and(eq(purchaseOrderItems.id, itemId), eq(purchaseOrderItems.purchaseOrderId, poId)));
  if (!item) throw new Error("Item não encontrado.");

  const quantity = optionalNumber(formData, "quantity");
  const unitPrice = optionalNumber(formData, "unitPrice");
  await db.update(purchaseOrderItems).set({ quantity, unitPrice }).where(eq(purchaseOrderItems.id, itemId));

  const changes: string[] = [];
  if (Number(quantity ?? 0) !== Number(item.quantity ?? 0)) changes.push(`qtd ${item.quantity ?? "—"} → ${quantity ?? "—"}`);
  if (Number(unitPrice ?? 0) !== Number(item.unitPrice ?? 0)) changes.push(`preço ${item.unitPrice ?? "—"} → ${unitPrice ?? "—"}`);
  if (changes.length > 0) {
    await logPurchaseOrderEvent(db, poId, "ITEM_EDITADO", `${item.sku ? `${item.sku} — ` : ""}${item.description}: ${changes.join(", ")}`);
  }

  revalidatePath(`/pedidos-compra/${poId}`);
  revalidatePath("/pedidos-compra");
}

export async function removePurchaseOrderItem(itemId: string, poId: string) {
  const [po] = await db
    .select({ status: purchaseOrders.status, processId: purchaseOrders.processId })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, poId));
  if (!po) throw new Error("Pedido de compra não encontrado.");
  if (po.status === "CANCELADO") {
    redirect(withFlashError(`/pedidos-compra/${poId}`, "Pedido cancelado não pode ser alterado."));
  }
  if (po.processId) {
    redirect(withFlashError(`/pedidos-compra/${poId}`, "Este pedido já está em um processo. Remova-o do processo para alterar os itens."));
  }

  const [item] = await db
    .select()
    .from(purchaseOrderItems)
    .where(and(eq(purchaseOrderItems.id, itemId), eq(purchaseOrderItems.purchaseOrderId, poId)));
  await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, itemId));
  if (item) await logPurchaseOrderEvent(db, poId, "ITEM_REMOVIDO", `${item.sku ? `${item.sku} — ` : ""}${item.description}`);
  revalidatePath(`/pedidos-compra/${poId}`);
}

export async function updatePurchaseOrderStatus(poId: string, formData: FormData) {
  const status = String(formData.get("status") ?? "").trim();
  if (!["ENVIADO", "CONFIRMADO", "CANCELADO"].includes(status)) {
    throw new Error("Status inválido.");
  }

  const [current] = await db.select({ status: purchaseOrders.status }).from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!current) throw new Error("Pedido de compra não encontrado.");
  if (current.status === status) return;
  if (current.status === "CANCELADO") {
    redirect(withFlashError(`/pedidos-compra/${poId}`, "Pedido cancelado não pode mudar de status."));
  }

  const patch: Partial<typeof purchaseOrders.$inferInsert> = {
    status: status as (typeof purchaseOrders.$inferInsert)["status"],
    updatedAt: new Date(),
  };
  if (status === "ENVIADO") patch.sentAt = new Date();
  if (status === "CONFIRMADO") patch.confirmedAt = new Date();

  await db.update(purchaseOrders).set(patch).where(eq(purchaseOrders.id, poId));
  await logPurchaseOrderEvent(
    db,
    poId,
    status as "ENVIADO" | "CONFIRMADO" | "CANCELADO",
    `${PURCHASE_ORDER_STATUS_LABEL[current.status as PurchaseOrderStatus]} → ${PURCHASE_ORDER_STATUS_LABEL[status as PurchaseOrderStatus]}`,
  );

  revalidatePath(`/pedidos-compra/${poId}`);
  revalidatePath("/pedidos-compra");
}

export async function convertToProcess(poId: string, formData: FormData) {
  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!po) throw new Error("Pedido de compra não encontrado.");
  if (po.status !== "CONFIRMADO") throw new Error("Só é possível criar o processo depois que o pedido estiver Confirmado.");
  if (po.processId) throw new Error("Este pedido já foi convertido em processo.");

  const processNumber = String(formData.get("processNumber") ?? "").trim();
  if (!processNumber) throw new Error("Número do processo é obrigatório.");

  const [existing] = await db.select({ id: processes.id }).from(processes).where(eq(processes.processNumber, processNumber));
  if (existing) throw new Error(`Já existe um processo com o número "${processNumber}" — use um número diferente.`);

  const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));

  const [createdProcess] = await db
    .insert(processes)
    .values({
      processNumber,
      supplierId: po.supplierId,
      currency: po.currency,
      incoterm: po.incoterm,
      status: "PEDIDO",
      currentStep: 2,
    })
    .returning({ id: processes.id });

  if (items.length > 0) {
    await db.insert(processItems).values(
      items.map((item) => ({
        processId: createdProcess.id,
        productId: item.productId,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unitValueOverride: item.unitPrice,
        purchaseOrderId: poId,
      })),
    );
  }

  await db
    .update(purchaseOrders)
    .set({ processId: createdProcess.id, updatedAt: new Date() })
    .where(eq(purchaseOrders.id, poId));

  await logPurchaseOrderEvent(db, poId, "PROCESSO_VINCULADO", `${processNumber} · processo criado a partir deste pedido`);

  revalidatePath("/pedidos-compra");
  revalidatePath(`/pedidos-compra/${poId}`);
  revalidatePath("/processos");
  redirect(withFlash(`/processos/${createdProcess.id}`, "Pedido convertido em Processo de Importação."));
}

// Coloca o pedido em um processo que já existe (ex.: o contêiner que já tem
// pedidos de outros fornecedores).
export async function addToExistingProcess(poId: string, formData: FormData) {
  const processId = String(formData.get("processId") ?? "").trim();
  if (!processId) throw new Error("Escolha o processo.");
  try {
    await db.transaction((tx) => linkPurchaseOrderToProcess(tx, poId, processId));
  } catch (e) {
    if (e instanceof LinkError) throw new Error(e.message);
    throw e;
  }
  revalidatePath("/pedidos-compra");
  revalidatePath(`/pedidos-compra/${poId}`);
  revalidatePath(`/processos/${processId}`);
  revalidatePath("/processos");
  redirect(withFlash(`/processos/${processId}`, "Pedido adicionado ao processo."));
}

// ---- Packing list do pedido ----

// Nome seguro pro Storage (sem acento, espaço nem símbolos).
function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_");
}

// Anexa um ou mais arquivos de packing list ao pedido. Vale em qualquer status
// (a packing list costuma chegar depois do pedido confirmado); se o pedido já
// está num processo, ela também aparece lá.
export async function addPurchaseOrderPackingList(poId: string, formData: FormData) {
  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    redirect(withFlashError(`/pedidos-compra/${poId}`, "Selecione o arquivo da packing list."));
  }

  const [po] = await db
    .select({ status: purchaseOrders.status, processId: purchaseOrders.processId })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, poId));
  if (!po) throw new Error("Pedido de compra não encontrado.");
  if (po.status === "CANCELADO") {
    redirect(withFlashError(`/pedidos-compra/${poId}`, "Este pedido está cancelado."));
  }

  for (const file of files) {
    const path = `pedidos/${poId}/PACKING_LIST-${Date.now()}-${safeFileName(file.name)}`;
    const { error } = await supabaseAdmin.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (error) {
      redirect(withFlashError(`/pedidos-compra/${poId}`, `Falha no upload de ${file.name}: ${error.message}`));
    }
    await db.insert(purchaseOrderDocuments).values({
      purchaseOrderId: poId,
      docType: "PACKING_LIST",
      fileName: file.name,
      storagePath: path,
    });
    await logPurchaseOrderEvent(db, poId, "PACKING_LIST_ANEXADA", file.name);
  }

  if (po.processId) {
    await syncPackingListToProcess(db, po.processId);
    revalidatePath(`/processos/${po.processId}`);
  }
  revalidatePath(`/pedidos-compra/${poId}`);
  redirect(withFlash(`/pedidos-compra/${poId}`, files.length === 1 ? "Packing list anexada." : `${files.length} arquivos anexados.`));
}

export async function removePurchaseOrderDocument(docId: string, poId: string) {
  const [doc] = await db
    .select()
    .from(purchaseOrderDocuments)
    .where(and(eq(purchaseOrderDocuments.id, docId), eq(purchaseOrderDocuments.purchaseOrderId, poId)));
  if (!doc) throw new Error("Arquivo não encontrado.");
  const [po] = await db.select({ processId: purchaseOrders.processId }).from(purchaseOrders).where(eq(purchaseOrders.id, poId));

  // sai também do espaço "Packing List" do processo, se foi esse arquivo que ocupou
  await db
    .delete(processDocuments)
    .where(and(eq(processDocuments.purchaseOrderId, poId), eq(processDocuments.storagePath, doc.storagePath)));
  await db.delete(purchaseOrderDocuments).where(eq(purchaseOrderDocuments.id, docId));
  await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).remove([doc.storagePath]);
  await logPurchaseOrderEvent(db, poId, "PACKING_LIST_REMOVIDA", doc.fileName);

  if (po?.processId) {
    await syncPackingListToProcess(db, po.processId);
    revalidatePath(`/processos/${po.processId}`);
  }
  revalidatePath(`/pedidos-compra/${poId}`);
  redirect(withFlash(`/pedidos-compra/${poId}`, "Arquivo removido."));
}
