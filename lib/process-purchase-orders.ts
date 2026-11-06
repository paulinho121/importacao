import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  processDocuments,
  processes,
  processItems,
  purchaseOrderDocuments,
  purchaseOrders,
  purchaseOrderItems,
  suppliers,
} from "@/db/schema";
import { CLOSED_PROCESS_STATUSES } from "@/lib/status";
import { logPurchaseOrderEvent } from "@/lib/purchase-order-events";

// Um processo é uma importação (ex.: um contêiner vindo da China) que reúne
// vários pedidos de compra, de fornecedores diferentes (Aputure, Swit, DZO…).
// Cada pedido pertence a um único processo; os itens do pedido entram no
// processo marcados com o pedido de origem (process_items.purchase_order_id).

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class LinkError extends Error {}

// Vincula um pedido (rascunho, enviado ou confirmado) ao processo e traz os
// itens dele. Depois de vinculado, os itens do pedido ficam travados (ver
// addPurchaseOrderItem) para não divergirem dos itens já copiados.
export async function linkPurchaseOrderToProcess(tx: Tx, poId: string, processId: string) {
  // As três leituras são independentes: dentro da transação elas seguem juntas
  // pela mesma conexão (1 ida ao banco em vez de 3).
  const [[po], [process], items] = await Promise.all([
    tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)),
    tx.select().from(processes).where(eq(processes.id, processId)),
    tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId)),
  ]);
  if (!po) throw new LinkError("Pedido de compra não encontrado.");
  if (po.status === "CANCELADO") throw new LinkError(`O pedido ${po.poNumber} está cancelado e não pode entrar em um processo.`);
  if (po.processId) throw new LinkError(`O pedido ${po.poNumber} já está em um processo.`);
  if (!process) throw new LinkError("Processo não encontrado.");
  if ((CLOSED_PROCESS_STATUSES as readonly string[]).includes(process.status)) {
    throw new LinkError("Este processo já foi encerrado.");
  }

  // O que o processo ainda não tem herda do primeiro pedido.
  const patch: Partial<typeof processes.$inferInsert> = {};
  if (!process.currency && po.currency) patch.currency = po.currency;
  if (!process.incoterm && po.incoterm) patch.incoterm = po.incoterm;

  // Os três grupos de gravação não dependem um do outro: saem juntos.
  await Promise.all([
    items.length > 0
      ? tx.insert(processItems).values(
          items.map((item) => ({
            processId,
            purchaseOrderId: poId,
            productId: item.productId,
            sku: item.sku,
            description: item.description,
            quantity: item.quantity,
            unitValueOverride: item.unitPrice,
          })),
        )
      : undefined,
    tx.update(purchaseOrders).set({ processId, updatedAt: new Date() }).where(eq(purchaseOrders.id, poId)),
    Object.keys(patch).length > 0
      ? tx.update(processes).set({ ...patch, updatedAt: new Date() }).where(eq(processes.id, processId))
      : undefined,
  ]);
  await syncPackingListToProcess(tx, processId);
  await logPurchaseOrderEvent(tx, poId, "PROCESSO_VINCULADO", `${process.processNumber} · ${items.length} ${items.length === 1 ? "item" : "itens"}`);
  return { itemCount: items.length };
}

// A packing list anexada ao pedido vai junto pro processo: se o espaço "Packing
// List" do processo ainda está vazio, ele é preenchido com a do primeiro pedido
// que tiver uma (o arquivo é o mesmo, não é copiado). Um processo reúne vários
// pedidos, então as packing lists de cada um continuam listadas por pedido.
export async function syncPackingListToProcess(tx: Tx | typeof db, processId: string) {
  // As duas leituras são independentes: saem juntas (1 ida em vez de 2).
  const [[slot], [doc]] = await Promise.all([
    tx
      .select()
      .from(processDocuments)
      .where(and(eq(processDocuments.processId, processId), eq(processDocuments.docType, "PACKING_LIST"))),
    tx
      .select({
        poId: purchaseOrders.id,
        fileName: purchaseOrderDocuments.fileName,
        storagePath: purchaseOrderDocuments.storagePath,
      })
      .from(purchaseOrderDocuments)
      .innerJoin(purchaseOrders, eq(purchaseOrderDocuments.purchaseOrderId, purchaseOrders.id))
      .where(and(eq(purchaseOrders.processId, processId), eq(purchaseOrderDocuments.docType, "PACKING_LIST")))
      .orderBy(purchaseOrderDocuments.uploadedAt)
      .limit(1),
  ]);
  if (slot?.status === "UPLOADED") return;
  if (!doc) return;

  const values = {
    fileName: doc.fileName,
    storagePath: doc.storagePath,
    status: "UPLOADED" as const,
    uploadedAt: new Date(),
    purchaseOrderId: doc.poId,
  };
  if (slot) await tx.update(processDocuments).set(values).where(eq(processDocuments.id, slot.id));
  else await tx.insert(processDocuments).values({ processId, docType: "PACKING_LIST", ...values });
}

// Tira o pedido do processo e remove os itens que vieram dele (os itens
// digitados direto no processo ficam).
export async function unlinkPurchaseOrderFromProcess(tx: Tx, poId: string, processId: string) {
  const [[po], [process]] = await Promise.all([
    tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)),
    tx.select({ processNumber: processes.processNumber }).from(processes).where(eq(processes.id, processId)),
  ]);
  if (!po || po.processId !== processId) throw new LinkError("Este pedido não está neste processo.");
  // As três remoções não dependem uma da outra: saem juntas. A packing list que
  // veio deste pedido sai do processo; outro pedido pode ocupar o lugar (depois).
  await Promise.all([
    tx.delete(processItems).where(and(eq(processItems.processId, processId), eq(processItems.purchaseOrderId, poId))),
    tx.update(purchaseOrders).set({ processId: null, updatedAt: new Date() }).where(eq(purchaseOrders.id, poId)),
    tx
      .delete(processDocuments)
      .where(and(eq(processDocuments.processId, processId), eq(processDocuments.purchaseOrderId, poId))),
  ]);
  await syncPackingListToProcess(tx, processId);
  await logPurchaseOrderEvent(tx, poId, "PROCESSO_REMOVIDO", process ? process.processNumber : null);
}

export type ProcessSupplier = { id: string; name: string; logoUrl: string | null };

// Fornecedores de cada processo: o principal + os dos pedidos vinculados
// (sem repetir), na ordem principal primeiro.
export async function getSuppliersByProcess(processIds: string[]): Promise<Map<string, ProcessSupplier[]>> {
  const out = new Map<string, ProcessSupplier[]>();
  if (processIds.length === 0) return out;

  const primary = await db
    .select({ processId: processes.id, id: suppliers.id, name: suppliers.name, logoUrl: suppliers.logoUrl })
    .from(processes)
    .innerJoin(suppliers, eq(processes.supplierId, suppliers.id))
    .where(inArray(processes.id, processIds));
  const viaPo = await db
    .selectDistinct({
      processId: purchaseOrders.processId,
      id: suppliers.id,
      name: suppliers.name,
      logoUrl: suppliers.logoUrl,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(inArray(purchaseOrders.processId, processIds));

  for (const row of [...primary, ...viaPo.filter((r) => r.processId)]) {
    const list = out.get(row.processId!) ?? [];
    if (!list.some((s) => s.id === row.id)) list.push({ id: row.id, name: row.name, logoUrl: row.logoUrl });
    out.set(row.processId!, list);
  }
  return out;
}
