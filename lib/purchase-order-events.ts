import { db } from "@/db/client";
import { purchaseOrderEvents } from "@/db/schema";
import { getCurrentUser, type CurrentUser } from "@/lib/supabase-server";

type DbLike = Pick<typeof db, "insert">;

// Para os eventos de processo a descrição começa com o número do processo
// ("PRC-2026-001 · 4 itens") e o título mostra "Incluído no processo PRC-2026-001".
// Rótulo e ícone de cada tipo de evento do histórico do pedido.
export const PO_EVENT_META: Record<string, { label: string; icon: string }> = {
  CRIADO: { label: "Pedido criado", icon: "add_circle" },
  EDITADO: { label: "Pedido editado", icon: "edit" },
  ITEM_ADICIONADO: { label: "Item adicionado", icon: "playlist_add" },
  ITEM_EDITADO: { label: "Item alterado", icon: "edit_note" },
  ITEM_REMOVIDO: { label: "Item removido", icon: "playlist_remove" },
  ENVIADO: { label: "Marcado como Enviado", icon: "send" },
  CONFIRMADO: { label: "Confirmado pelo fornecedor", icon: "check_circle" },
  CANCELADO: { label: "Pedido cancelado", icon: "cancel" },
  PACKING_LIST_ANEXADA: { label: "Packing list anexada", icon: "inventory" },
  PACKING_LIST_REMOVIDA: { label: "Packing list removida", icon: "folder_delete" },
  LINKS_ATUALIZADOS: { label: "Links da packing list / invoice atualizados", icon: "link" },
  PROCESSO_VINCULADO: { label: "Incluído no processo", icon: "local_shipping" },
  PROCESSO_REMOVIDO: { label: "Retirado do processo", icon: "undo" },
};

// Registra um passo no histórico do pedido, com quem fez (nome ou e-mail do
// usuário logado). Nunca derruba a ação principal: se o registro falhar,
// só não aparece no histórico.
// `userPromise` (opcional): quem chama pode disparar getCurrentUser() no início
// da ação, para a validação de login rodar em paralelo com as consultas, e
// passar a promessa aqui — o registro não espera uma nova ida ao serviço de login.
export async function logPurchaseOrderEvent(
  tx: DbLike,
  poId: string,
  eventType: keyof typeof PO_EVENT_META,
  description: string | null = null,
  userPromise?: Promise<CurrentUser | null>,
) {
  try {
    const user = await (userPromise ?? getCurrentUser()).catch(() => null);
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
