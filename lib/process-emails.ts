// Leitura dos e-mails (com anexos) para as telas de processo e de não vinculados.
import { desc, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { processEmails, processEmailAttachments } from "@/db/schema";
import { getSignedDocumentUrl } from "@/lib/supabase-admin";

// Link de anexo: curta duração, mas longo o bastante para a pessoa abrir a página e clicar.
const ATTACHMENT_URL_SECONDS = 60 * 60;

export type EmailAttachmentView = {
  id: string;
  fileName: string;
  sizeBytes: number | null;
  // null quando o anexo não foi salvo (falha no download ou no upload).
  url: string | null;
};

export type EmailView = {
  id: string;
  from: string | null;
  to: string | null;
  subject: string | null;
  sentAt: Date;
  snippet: string | null;
  bodyText: string | null;
  processId: string | null;
  linkedAt: Date | null;
  attachments: EmailAttachmentView[];
};

export async function loadEmails(where: SQL | undefined, limit: number): Promise<EmailView[]> {
  const rows = await db
    .select({
      id: processEmails.id,
      from: processEmails.from,
      to: processEmails.to,
      subject: processEmails.subject,
      sentAt: processEmails.sentAt,
      snippet: processEmails.snippet,
      bodyText: processEmails.bodyText,
      processId: processEmails.processId,
      linkedAt: processEmails.linkedAt,
    })
    .from(processEmails)
    .where(where)
    .orderBy(desc(processEmails.sentAt))
    .limit(limit);
  if (rows.length === 0) return [];

  const attachments = await db
    .select()
    .from(processEmailAttachments)
    .where(
      inArray(
        processEmailAttachments.emailId,
        rows.map((r) => r.id),
      ),
    );
  const urls = await Promise.all(
    attachments.map((a) => (a.storagePath ? getSignedDocumentUrl(a.storagePath, ATTACHMENT_URL_SECONDS) : null)),
  );

  const byEmail = new Map<string, EmailAttachmentView[]>();
  attachments.forEach((a, i) => {
    const list = byEmail.get(a.emailId) ?? [];
    list.push({ id: a.id, fileName: a.fileName, sizeBytes: a.sizeBytes, url: urls[i] });
    byEmail.set(a.emailId, list);
  });

  return rows.map((r) => ({ ...r, attachments: byEmail.get(r.id) ?? [] }));
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
