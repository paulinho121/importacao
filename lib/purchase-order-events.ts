import { db } from "@/db/client";
import { purchaseOrderEvents } from "@/db/schema";
import { getCurrentUser } from "@/lib/supabase-server";

type DbLike = Pick<typeof db, "insert">;

// Rótulo e ícone de cada tipo de evento do histórico do pedido.
export const PO_EVENT_META: Record<string, { label: string; icon: string }> = {
  CRIADO: { label: "Pedido criado", icon: "add_circle" },
  EDITADO: { label: "Pedido editado", icon: "edit" },
  ITEM_ADICIONADO: { label: "Item adicionado", icon: "playlist_add" },
  ITEM_EDITADO: { label: "Item alterado", icon: "edit_note" },
  ITEM_REMOVIDO: { label: "Item removido", icon: "playlist_remove" },
  ENVIADO: { label: "Enviado ao fornecedor", icon: "send" },
  CONFIRMADO: { label: "Confirmado pelo fornecedor", icon: "check_circle" },
  CANCELADO: { label: "Pedido cancelado", icon: "cancel" },
  PACKING_LIST_ANEXADA: { label: "Packing list anexada", icon: "inventory" },
  PACKING_LIST_REMOVIDA: { label: "Packing list removida", icon: "folder_delete" },
  PROCESSO_VINCULADO: { label: "Colocado em processo", icon: "local_shipping" },
  PROCESSO_REMOVIDO: { label: "Retirado do processo", icon: "undo" },
};

// Registra um passo no histórico do pedido, com quem fez (nome ou e-mail do
// usuário logado). Nunca derruba a ação principal: se o registro falhar,
// só não aparece no histórico.
export async function logPurchaseOrderEvent(
  tx: DbLike,
  poId: string,
  eventType: keyof typeof PO_EVENT_META,
  description: string | null = null,
) {
  try {
    const user = await getCurrentUser().catch(() => null);
    await tx.insert(purchaseOrderEvents).values({
      purchaseOrderId: poId,
      eventType,
      description,
      userName: user ? (user.name ?? user.email) : null,
    });
  } catch (e) {
    console.error("Falha ao registrar histórico do pedido", e);
  }
}
