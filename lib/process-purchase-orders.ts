import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { processes, processItems, purchaseOrders, purchaseOrderItems, suppliers } from "@/db/schema";
import { CLOSED_PROCESS_STATUSES } from "@/lib/status";

// Um processo é uma importação (ex.: um contêiner vindo da China) que reúne
// vários pedidos de compra, de fornecedores diferentes (Aputure, Swit, DZO…).
// Cada pedido pertence a um único processo; os itens do pedido entram no
// processo marcados com o pedido de origem (process_items.purchase_order_id).

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class LinkError extends Error {}

// Vincula um pedido CONFIRMADO ao processo e traz os itens dele.
export async function linkPurchaseOrderToProcess(tx: Tx, poId: string, processId: string) {
  const [po] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!po) throw new LinkError("Pedido de compra não encontrado.");
  if (po.status !== "CONFIRMADO") throw new LinkError("Só pedidos Confirmados podem entrar em um processo.");
  if (po.processId) throw new LinkError("Este pedido já está em um processo.");

  const [process] = await tx.select().from(processes).where(eq(processes.id, processId));
  if (!process) throw new LinkError("Processo não encontrado.");
  if ((CLOSED_PROCESS_STATUSES as readonly string[]).includes(process.status)) {
    throw new LinkError("Este processo já foi encerrado.");
  }

  const items = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));
  if (items.length > 0) {
    await tx.insert(processItems).values(
      items.map((item) => ({
        processId,
        purchaseOrderId: poId,
        productId: item.productId,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unitValueOverride: item.unitPrice,
      })),
    );
  }

  await tx.update(purchaseOrders).set({ processId, updatedAt: new Date() }).where(eq(purchaseOrders.id, poId));

  // O que o processo ainda não tem herda do primeiro pedido.
  const patch: Partial<typeof processes.$inferInsert> = {};
  if (!process.currency && po.currency) patch.currency = po.currency;
  if (!process.incoterm && po.incoterm) patch.incoterm = po.incoterm;
  if (Object.keys(patch).length > 0) {
    await tx.update(processes).set({ ...patch, updatedAt: new Date() }).where(eq(processes.id, processId));
  }
  return { itemCount: items.length };
}

// Tira o pedido do processo e remove os itens que vieram dele (os itens
// digitados direto no processo ficam).
export async function unlinkPurchaseOrderFromProcess(tx: Tx, poId: string, processId: string) {
  const [po] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!po || po.processId !== processId) throw new LinkError("Este pedido não está neste processo.");
  await tx
    .delete(processItems)
    .where(and(eq(processItems.processId, processId), eq(processItems.purchaseOrderId, poId)));
  await tx.update(purchaseOrders).set({ processId: null, updatedAt: new Date() }).where(eq(purchaseOrders.id, poId));
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
