// Cliente mínimo do Google (OAuth 2.0 + Gmail API) usando fetch, sem SDK.
// Escopo somente leitura. Tokens nunca são logados nem devolvidos ao browser:
// os erros carregam só o código/status HTTP do Google.
import type { GmailMessage } from "@/lib/gmail-message";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
// Só entram e-mails com este marcador no Gmail.
export const GMAIL_LABEL = "Processos - 2026";
export const GMAIL_STATE_COOKIE = "gmail_oauth_state";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GMAIL_USER_URL = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason: string | null = null,
  ) {
    super(message);
    this.name = "GmailApiError";
  }
}

export function getGoogleCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET não definidas. Defina em .env.local (desenvolvimento) e em Environment Variables (Vercel).",
    );
  }
  return { clientId, clientSecret };
}

// Precisa ser exatamente um dos redirects cadastrados no cliente OAuth do Google.
export function gmailRedirectUri(origin: string): string {
  return new URL("/api/gmail/callback", origin).toString();
}

export function buildAuthUrl(params: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPE,
    // offline + consent: o Google devolve sempre um refresh token.
    access_type: "offline",
    prompt: "consent",
    state: params.state,
  }).toString();
  return url.toString();
}

async function postToken(body: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const reason = typeof json.error === "string" ? json.error : null;
    throw new GmailApiError(`Google recusou o token (HTTP ${res.status}${reason ? `, ${reason}` : ""})`, res.status, reason);
  }
  return json;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
}> {
  const { clientId, clientSecret } = getGoogleCredentials();
  const json = await postToken({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  return {
    accessToken: String(json.access_token ?? ""),
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : null,
  };
}

// Access token de curta duração a partir do refresh token guardado.
// Lança GmailApiError com reason "invalid_grant" quando o acesso foi revogado/expirou.
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = getGoogleCredentials();
  const json = await postToken({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });
  return String(json.access_token ?? "");
}

// Melhor esforço: desfaz o acesso no Google ao desconectar.
export async function revokeToken(token: string): Promise<void> {
  await fetch(REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }).toString(),
    cache: "no-store",
  }).catch(() => undefined);
}

async function gmailGet<T>(accessToken: string, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${GMAIL_USER_URL}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new GmailApiError(`Gmail respondeu HTTP ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

export async function getMailboxAddress(accessToken: string): Promise<string> {
  const profile = await gmailGet<{ emailAddress?: string }>(accessToken, "/profile");
  if (!profile.emailAddress) throw new GmailApiError("Perfil do Gmail sem endereço", 500);
  return profile.emailAddress;
}

// Todos os ids que batem com a busca (paginado, com teto de páginas).
export async function listMessageIds(accessToken: string, query: string, maxPages = 20): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = { q: query, maxResults: "100", includeSpamTrash: "false" };
    if (pageToken) params.pageToken = pageToken;
    const data = await gmailGet<{ messages?: { id: string }[]; nextPageToken?: string }>(
      accessToken,
      "/messages",
      params,
    );
    for (const m of data.messages ?? []) ids.push(m.id);
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return ids;
}

export async function getMessage(accessToken: string, id: string): Promise<GmailMessage> {
  return gmailGet<GmailMessage>(accessToken, `/messages/${encodeURIComponent(id)}`, { format: "full" });
}

// Bytes de um anexo (ou de um corpo grande). A API devolve base64url.
export async function getAttachmentBytes(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<Uint8Array> {
  const data = await gmailGet<{ data?: string }>(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
  );
  if (!data.data) return new Uint8Array();
  const base64 = data.data.replace(/-/g, "+").replace(/_/g, "/");
  return new Uint8Array(Buffer.from(base64, "base64"));
}
