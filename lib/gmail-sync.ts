// Sincronização dos e-mails com o marcador "Processos" para o banco e o bucket de
// documentos. Usada pelo botão "Sincronizar agora" e pelo cron da Vercel.
//
// Regras:
// - Busca: marcador (pelo ID) + janela móvel de INITIAL_LOOKBACK_DAYS. Não usa cursor
//   pela data de recebimento, porque o marcador pode ser aplicado depois que o e-mail
//   chegou. gmail_connections.last_synced_at só avança quando a rodada termina inteira;
//   se o tempo acabar antes, a próxima rodada retoma (os já importados são pulados pelo
//   gmail_message_id, então refazer a janela é barato).
// - Nada se perde: e-mail sem processo entra como "não vinculado"; anexo que falha
//   fica com storage_path nulo e aparece como indisponível.
// - Nunca logar corpo, assunto, remetente, nome de anexo nem token: só contagens
//   e códigos de erro.
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { gmailConnections, processEmails, processEmailAttachments } from "@/db/schema";
import { DOCUMENTS_BUCKET, supabaseAdmin } from "@/lib/supabase-admin";
import {
  GMAIL_LABEL,
  GmailApiError,
  findLabelId,
  getAttachmentBytes,
  getMessage,
  listMessageIds,
  refreshAccessToken,
} from "@/lib/gmail";
import { parseGmailMessage, type ParsedAttachment, type ParsedEmail } from "@/lib/gmail-message";

// Janela de busca: e-mails recebidos nos últimos N dias que tenham o marcador. É
// uma janela móvel, não um cursor: o marcador pode ser aplicado depois que o e-mail
// chegou, então um cursor pela data de recebimento deixaria esse e-mail de fora.
export const INITIAL_LOOKBACK_DAYS = 90;
const BATCH_SIZE = 5;
const DAY_MS = 86_400_000;

export type GmailConnection = typeof gmailConnections.$inferSelect;

export type SyncOutcome = {
  ok: boolean;
  imported: number;
  complete: boolean;
  needsReconnect: boolean;
  message: string;
};

function errorLabel(e: unknown): string {
  if (e instanceof GmailApiError) return `HTTP ${e.status}${e.reason ? ` ${e.reason}` : ""}`;
  if (e instanceof Error) return e.name;
  return "erro";
}

function safeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return (cleaned || "anexo").slice(0, 120);
}

async function saveAttachment(
  emailId: string,
  index: number,
  att: ParsedAttachment,
  gmailMessageId: string,
  accessToken: string,
): Promise<void> {
  let storagePath: string | null = null;
  let sizeBytes: number | null = att.sizeBytes;
  try {
    const bytes = att.inlineBase64Url
      ? new Uint8Array(Buffer.from(att.inlineBase64Url.replace(/-/g, "+").replace(/_/g, "/"), "base64"))
      : await getAttachmentBytes(accessToken, gmailMessageId, att.attachmentId!);
    sizeBytes = bytes.byteLength;
    const path = `emails/${emailId}/${index + 1}-${safeFileName(att.fileName)}`;
    const { error } = await supabaseAdmin.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, Buffer.from(bytes), {
        contentType: att.mimeType ?? "application/octet-stream",
        upsert: false,
      });
    if (error) throw error;
    storagePath = path;
  } catch (e) {
    console.error("Gmail: anexo não salvo", errorLabel(e));
  }
  await db.insert(processEmailAttachments).values({
    emailId,
    fileName: att.fileName,
    mimeType: att.mimeType,
    sizeBytes,
    storagePath,
  });
}

// "imported" = gravado agora; "duplicate" = já existia (mesmo e-mail em outra conta).
async function storeEmail(
  mailboxUserId: string,
  email: ParsedEmail,
  accessToken: string,
): Promise<"imported" | "duplicate"> {
  if (email.messageIdHeader) {
    const [existing] = await db
      .select({ id: processEmails.id })
      .from(processEmails)
      .where(eq(processEmails.messageIdHeader, email.messageIdHeader))
      .limit(1);
    if (existing) return "duplicate";
  }

  const [row] = await db
    .insert(processEmails)
    .values({
      gmailMessageId: email.gmailMessageId,
      messageIdHeader: email.messageIdHeader,
      mailboxUserId,
      from: email.from,
      to: email.to,
      subject: email.subject,
      sentAt: email.sentAt,
      snippet: email.snippet,
      bodyText: email.bodyText,
      status: "UNLINKED",
    })
    .onConflictDoNothing()
    .returning({ id: processEmails.id });
  if (!row) return "duplicate";

  for (const [index, att] of email.attachments.entries()) {
    await saveAttachment(row.id, index, att, email.gmailMessageId, accessToken);
  }
  return "imported";
}

async function importOne(
  accessToken: string,
  mailboxUserId: string,
  gmailMessageId: string,
): Promise<"imported" | "duplicate" | "failed"> {
  try {
    const message = await getMessage(accessToken, gmailMessageId);
    const parsed = await parseGmailMessage(message, (attachmentId) =>
      getAttachmentBytes(accessToken, gmailMessageId, attachmentId),
    );
    return await storeEmail(mailboxUserId, parsed, accessToken);
  } catch (e) {
    console.error("Gmail: mensagem não importada", errorLabel(e));
    return "failed";
  }
}

async function recordSyncError(userId: string, message: string | null) {
  await db.update(gmailConnections).set({ lastSyncError: message }).where(eq(gmailConnections.userId, userId));
}

export async function syncGmailConnection(
  conn: GmailConnection,
  opts: { deadlineMs: number },
): Promise<SyncOutcome> {
  const runStart = new Date();

  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(conn.refreshToken);
  } catch (e) {
    if (e instanceof GmailApiError && e.reason === "invalid_grant") {
      // Acesso revogado ou expirado: a conexão não serve mais. Remove e pede nova conexão.
      await db.delete(gmailConnections).where(eq(gmailConnections.userId, conn.userId));
      return {
        ok: false,
        imported: 0,
        complete: false,
        needsReconnect: true,
        message: "A autorização do Gmail expirou ou foi revogada. Conecte a conta de novo.",
      };
    }
    const message = "Não foi possível falar com o Google agora. Tente de novo em instantes.";
    await recordSyncError(conn.userId, message);
    return { ok: false, imported: 0, complete: false, needsReconnect: false, message };
  }

  const afterSeconds = Math.floor((runStart.getTime() - INITIAL_LOOKBACK_DAYS * DAY_MS) / 1000);

  let ids: string[];
  try {
    const labelId = await findLabelId(accessToken, GMAIL_LABEL);
    if (!labelId) {
      const message = `O marcador "${GMAIL_LABEL}" não existe nesta conta do Gmail.`;
      await recordSyncError(conn.userId, message);
      return { ok: false, imported: 0, complete: false, needsReconnect: false, message };
    }
    ids = await listMessageIds(accessToken, `after:${afterSeconds}`, 20, labelId);
  } catch (e) {
    const message = `Falha ao listar os e-mails no Gmail (${errorLabel(e)}).`;
    await recordSyncError(conn.userId, message);
    return { ok: false, imported: 0, complete: false, needsReconnect: false, message };
  }

  const known = new Set<string>();
  if (ids.length > 0) {
    const rows = await db
      .select({ gmailMessageId: processEmails.gmailMessageId })
      .from(processEmails)
      .where(inArray(processEmails.gmailMessageId, ids));
    for (const r of rows) known.add(r.gmailMessageId);
  }
  const pending = ids.filter((id) => !known.has(id));

  let imported = 0;
  let failed = 0;
  let timedOut = false;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    if (Date.now() >= opts.deadlineMs) {
      timedOut = true;
      break;
    }
    const batch = pending.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((id) => importOne(accessToken, conn.userId, id)));
    for (const r of results) {
      if (r === "imported") imported++;
      else if (r === "failed") failed++;
    }
  }

  const complete = !timedOut && failed === 0;
  const errorNote =
    failed > 0 ? `${failed} e-mail(s) não puderam ser importados. Serão tentados de novo na próxima sincronização.` : null;
  await db
    .update(gmailConnections)
    .set({
      lastSyncedAt: complete ? runStart : conn.lastSyncedAt,
      lastSyncError: errorNote,
    })
    .where(eq(gmailConnections.userId, conn.userId));

  const parts: string[] = [];
  if (imported > 0) parts.push(`${imported} e-mail(s) novo(s) importado(s).`);
  else if (complete && ids.length === 0)
    parts.push(`Nenhum e-mail com o marcador "${GMAIL_LABEL}" nos últimos ${INITIAL_LOOKBACK_DAYS} dias.`);
  else if (complete) parts.push("Todos os e-mails com o marcador já estavam importados.");
  if (timedOut) parts.push("Sincronização parcial: o restante entra na próxima rodada.");
  if (errorNote) parts.push(errorNote);

  return {
    ok: failed === 0,
    imported,
    complete,
    needsReconnect: false,
    message: parts.join(" ") || "Nenhum e-mail novo.",
  };
}
