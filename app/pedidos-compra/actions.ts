"use server";

import { db } from "@/db/client";
import { purchaseOrders, purchaseOrderItems, products, processes, processItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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

export async function createPurchaseOrder(formData: FormData) {
  const poNumber = String(formData.get("poNumber") ?? "").trim();
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  if (!poNumber) throw new Error("Número do pedido é obrigatório.");
  if (!supplierId) throw new Error("Fornecedor é obrigatório.");

  const user = await getCurrentUser();

  const [created] = await db
    .insert(purchaseOrders)
    .values({
      poNumber,
      supplierId,
      currency: optionalText(formData, "currency") as (typeof purchaseOrders.$inferInsert)["currency"] | null,
      incoterm: optionalText(formData, "incoterm"),
      expectedDeliveryDate: optionalDate(formData, "expectedDeliveryDate"),
      notes: optionalText(formData, "notes"),
      createdByUserId: user?.id ?? null,
    })
    .returning({ id: purchaseOrders.id });

  revalidatePath("/pedidos-compra");
  redirect(`/pedidos-compra/${created.id}`);
}

export async function updatePurchaseOrder(poId: string, formData: FormData) {
  const [po] = await db.select({ status: purchaseOrders.status }).from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (po?.status !== "RASCUNHO") throw new Error("Só é possível editar o pedido enquanto ele está em Rascunho.");

  const poNumber = String(formData.get("poNumber") ?? "").trim();
  if (!poNumber) throw new Error("Número do pedido é obrigatório.");

  const [existing] = await db.select({ id: purchaseOrders.id }).from(purchaseOrders).where(eq(purchaseOrders.poNumber, poNumber));
  if (existing && existing.id !== poId) {
    throw new Error(`Já existe um pedido com o número "${poNumber}" — use um número diferente.`);
  }

  await db
    .update(purchaseOrders)
    .set({
      poNumber,
      currency: optionalText(formData, "currency") as (typeof purchaseOrders.$inferInsert)["currency"] | null,
      incoterm: optionalText(formData, "incoterm"),
      expectedDeliveryDate: optionalDate(formData, "expectedDeliveryDate"),
      notes: optionalText(formData, "notes"),
      updatedAt: new Date(),
    })
    .where(eq(purchaseOrders.id, poId));

  revalidatePath(`/pedidos-compra/${poId}`);
  revalidatePath("/pedidos-compra");
}

export async function addPurchaseOrderItem(poId: string, formData: FormData) {
  const productId = optionalText(formData, "productId");
  const quantity = optionalNumber(formData, "quantity");
  const unitPrice = optionalNumber(formData, "unitPrice");

  const [po] = await db.select({ status: purchaseOrders.status }).from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (po?.status !== "RASCUNHO") throw new Error("Só é possível adicionar itens enquanto o pedido está em Rascunho.");

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
  }

  revalidatePath(`/pedidos-compra/${poId}`);
}

export async function removePurchaseOrderItem(itemId: string, poId: string) {
  const [po] = await db.select({ status: purchaseOrders.status }).from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (po?.status !== "RASCUNHO") throw new Error("Só é possível remover itens enquanto o pedido está em Rascunho.");

  await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, itemId));
  revalidatePath(`/pedidos-compra/${poId}`);
}

export async function updatePurchaseOrderStatus(poId: string, formData: FormData) {
  const status = String(formData.get("status") ?? "").trim();
  if (!["ENVIADO", "CONFIRMADO", "CANCELADO"].includes(status)) {
    throw new Error("Status inválido.");
  }

  const patch: Partial<typeof purchaseOrders.$inferInsert> = {
    status: status as (typeof purchaseOrders.$inferInsert)["status"],
    updatedAt: new Date(),
  };
  if (status === "ENVIADO") patch.sentAt = new Date();
  if (status === "CONFIRMADO") patch.confirmedAt = new Date();

  await db.update(purchaseOrders).set(patch).where(eq(purchaseOrders.id, poId));

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
      })),
    );
  }

  await db
    .update(purchaseOrders)
    .set({ processId: createdProcess.id, updatedAt: new Date() })
    .where(eq(purchaseOrders.id, poId));

  revalidatePath("/pedidos-compra");
  revalidatePath(`/pedidos-compra/${poId}`);
  revalidatePath("/processos");
  redirect(`/processos/${createdProcess.id}`);
}
