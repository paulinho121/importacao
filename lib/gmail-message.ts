// Leitura do formato de mensagem da Gmail API (format=full) em um objeto simples.
// Funções puras, sem rede nem banco: o download de anexos entra como parâmetro.
// Nunca registrar (log/erro) o conteúdo daqui: corpo, assunto e nomes de anexo são dados do cliente.

export type GmailHeader = { name: string; value: string };

export type GmailPart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailPart[];
};

export type GmailMessage = {
  id: string;
  threadId?: string;
  internalDate?: string; // epoch em milissegundos, como texto
  snippet?: string;
  payload?: GmailPart;
};

export type ParsedAttachment = {
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  // Anexo que precisa ser baixado pela API, ou conteúdo já vindo na mensagem (base64url).
  attachmentId?: string;
  inlineBase64Url?: string;
};

export type ParsedEmail = {
  gmailMessageId: string;
  messageIdHeader: string | null;
  from: string | null;
  to: string | null;
  subject: string | null;
  sentAt: Date;
  snippet: string | null;
  bodyText: string;
  attachments: ParsedAttachment[];
};

// Corpo guardado com teto: e-mail gigante (newsletter, thread colada) não deve inflar o banco.
export const MAX_BODY_CHARS = 150_000;

export function headerValue(headers: GmailHeader[] | undefined, name: string): string | null {
  const wanted = name.toLowerCase();
  const found = headers?.find((h) => h.name.toLowerCase() === wanted);
  return found?.value?.trim() || null;
}

function charsetOf(headers: GmailHeader[] | undefined): string {
  const contentType = headerValue(headers, "Content-Type") ?? "";
  const match = /charset\s*=\s*"?([^";\s]+)"?/i.exec(contentType);
  return match?.[1]?.toLowerCase() ?? "utf-8";
}

function decodeWithCharset(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

export function base64UrlToBytes(data: string): Uint8Array {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return new Uint8Array(Buffer.from(base64, "base64"));
}

// Cabeçalhos podem vir como palavras codificadas RFC 2047: =?UTF-8?B?...?= / =?ISO-8859-1?Q?...?=
export function decodeMimeWords(value: string): string {
  return value.replace(/=\?([^?\s]+)\?([BbQq])\?([^?\s]*)\?=/g, (_whole, charset: string, enc: string, text: string) => {
    try {
      const bytes =
        enc.toUpperCase() === "B"
          ? new Uint8Array(Buffer.from(text, "base64"))
          : qDecode(text);
      return decodeWithCharset(bytes, charset.toLowerCase());
    } catch {
      return text;
    }
  });
}

function qDecode(text: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "_") out.push(0x20);
    else if (c === "=" && /^[0-9A-Fa-f]{2}$/.test(text.slice(i + 1, i + 3))) {
      out.push(parseInt(text.slice(i + 1, i + 3), 16));
      i += 2;
    } else out.push(c.charCodeAt(0) & 0xff);
  }
  return new Uint8Array(out);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

// HTML → texto simples para quando o e-mail só tem a versão HTML.
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ent: string) => {
      if (ent[0] === "#") {
        const code = ent[1].toLowerCase() === "x" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
      }
      return NAMED_ENTITIES[ent.toLowerCase()] ?? whole;
    });
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t\r\f\v]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fileNameFor(part: GmailPart, index: number): string {
  if (part.filename) return decodeMimeWords(part.filename);
  const ext = (part.mimeType ?? "").split("/")[1]?.split(";")[0] || "bin";
  return `anexo-${index + 1}.${ext}`;
}

type Collected = {
  plain: string[];
  html: string[];
  attachments: ParsedAttachment[];
};

// Percorre a árvore de partes. Texto (text/plain, text/html) vira corpo; qualquer
// outra folha com conteúdo vira anexo. Texto grande que a API devolve como
// attachmentId (o Gmail faz isso com corpos muito longos) é baixado como corpo.
async function collect(
  part: GmailPart,
  fetchAttachment: (attachmentId: string) => Promise<Uint8Array>,
  out: Collected,
  counter: { n: number },
): Promise<void> {
  const mime = (part.mimeType ?? "").toLowerCase();
  const body = part.body ?? {};

  if (part.parts?.length) {
    for (const child of part.parts) await collect(child, fetchAttachment, out, counter);
    return;
  }

  const isTextBody = mime === "text/plain" || mime === "text/html";
  const hasFileName = Boolean(part.filename);

  if (isTextBody && !hasFileName) {
    let bytes: Uint8Array | null = null;
    if (body.data) bytes = base64UrlToBytes(body.data);
    else if (body.attachmentId) bytes = await fetchAttachment(body.attachmentId);
    if (bytes) {
      const text = decodeWithCharset(bytes, charsetOf(part.headers));
      (mime === "text/plain" ? out.plain : out.html).push(text);
    }
    return;
  }

  if (body.attachmentId || body.data) {
    out.attachments.push({
      fileName: fileNameFor(part, counter.n++),
      mimeType: part.mimeType ?? null,
      sizeBytes: body.size ?? null,
      attachmentId: body.attachmentId,
      inlineBase64Url: body.attachmentId ? undefined : body.data,
    });
  }
}

export async function parseGmailMessage(
  message: GmailMessage,
  fetchAttachment: (attachmentId: string) => Promise<Uint8Array>,
): Promise<ParsedEmail> {
  const headers = message.payload?.headers;
  const collected: Collected = { plain: [], html: [], attachments: [] };
  if (message.payload) await collect(message.payload, fetchAttachment, collected, { n: 0 });

  let bodyText = collected.plain.filter((t) => t.trim()).join("\n\n");
  if (!bodyText.trim()) bodyText = htmlToText(collected.html.join("\n"));
  if (bodyText.length > MAX_BODY_CHARS) bodyText = bodyText.slice(0, MAX_BODY_CHARS);

  const subject = headerValue(headers, "Subject");
  const sentMs = message.internalDate ? Number(message.internalDate) : NaN;
  const dateHeader = headerValue(headers, "Date");
  const sentAt = Number.isFinite(sentMs)
    ? new Date(sentMs)
    : dateHeader && !Number.isNaN(Date.parse(dateHeader))
      ? new Date(dateHeader)
      : new Date();

  return {
    gmailMessageId: message.id,
    messageIdHeader: headerValue(headers, "Message-ID") ?? headerValue(headers, "Message-Id"),
    from: headerValue(headers, "From") ? decodeMimeWords(headerValue(headers, "From")!) : null,
    to: headerValue(headers, "To") ? decodeMimeWords(headerValue(headers, "To")!) : null,
    subject: subject ? decodeMimeWords(subject) : null,
    sentAt,
    snippet: message.snippet ? decodeMimeWords(message.snippet) : null,
    bodyText,
    attachments: collected.attachments,
  };
}
