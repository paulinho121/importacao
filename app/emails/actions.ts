"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { gmailConnections, processEmails, processes } from "@/db/schema";
import { getCurrentUser } from "@/lib/supabase-server";
import { withFlash, withFlashError } from "@/lib/flash";
import { revokeToken } from "@/lib/gmail";
import { syncGmailConnection } from "@/lib/gmail-sync";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidateEmailViews(processId?: string | null) {
  revalidatePath("/emails");
  if (processId) revalidatePath(`/processos/${processId}`);
}

// Vincula um e-mail não vinculado a um processo (a sugestão já vem marcada no select).
export async function linkEmailToProcess(emailId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!UUID.test(emailId)) redirect(withFlashError("/emails", "E-mail inválido."));

  const processId = String(formData.get("processId") ?? "");
  if (!UUID.test(processId)) redirect(withFlashError("/emails", "Escolha um processo para vincular."));

  const [process] = await db
    .select({ processNumber: processes.processNumber })
    .from(processes)
    .where(eq(processes.id, processId));
  if (!process) redirect(withFlashError("/emails", "Processo não encontrado."));

  const [email] = await db
    .update(processEmails)
    .set({ processId, status: "LINKED", linkedBy: user.id, linkedAt: new Date() })
    .where(eq(processEmails.id, emailId))
    .returning({ id: processEmails.id });
  if (!email) redirect(withFlashError("/emails", "E-mail não encontrado."));

  revalidateEmailViews(processId);
  redirect(withFlash("/emails", `E-mail vinculado ao processo #${process.processNumber}.`));
}

// Desvincula: o e-mail volta para "E-mails não vinculados". Nada é apagado.
export async function unlinkEmailFromProcess(emailId: string, processId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!UUID.test(emailId) || !UUID.test(processId)) redirect(withFlashError(`/processos/${processId}`, "Dados inválidos."));

  await db
    .update(processEmails)
    .set({ processId: null, status: "UNLINKED", linkedBy: null, linkedAt: null })
    .where(eq(processEmails.id, emailId));

  revalidateEmailViews(processId);
  redirect(withFlash(`/processos/${processId}`, "E-mail desvinculado. Ele voltou para E-mails não vinculados."));
}

// Botão "Sincronizar agora": roda a sincronização da conta de quem clicou.
export async function syncGmailNowAction() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [connection] = await db.select().from(gmailConnections).where(eq(gmailConnections.userId, user.id));
  if (!connection) redirect(withFlashError("/emails", "Conecte o Gmail primeiro."));

  const outcome = await syncGmailConnection(connection, { deadlineMs: Date.now() + 35_000 });
  revalidatePath("/emails");
  redirect(outcome.ok ? withFlash("/emails", outcome.message) : withFlashError("/emails", outcome.message));
}

// Desconecta a conta de quem clicou: revoga o acesso no Google e apaga o refresh token.
// Os e-mails já importados continuam salvos.
export async function disconnectGmailAction() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [connection] = await db.select().from(gmailConnections).where(eq(gmailConnections.userId, user.id));
  if (connection) {
    await revokeToken(connection.refreshToken);
    await db.delete(gmailConnections).where(eq(gmailConnections.userId, user.id));
  }

  revalidatePath("/emails");
  redirect(withFlash("/emails", "Gmail desconectado. Os e-mails já importados continuam salvos."));
}
