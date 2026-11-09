// Links do Google Drive das cotações de frete e das invoices: o time guarda o
// arquivo no Drive e cola o link aqui. Só aceita http(s) (nunca javascript:) e
// gera o link de download direto quando é um arquivo do Drive.

export const MAX_DRIVE_URL = 600;

export type DriveUrlResult = { ok: true; url: string | null } | { ok: false; error: string };

// Vazio vira null. Sem protocolo, assume https.
export function normalizeDriveUrl(raw: string | null | undefined): DriveUrlResult {
  const value = (raw ?? "").trim();
  if (!value) return { ok: true, url: null };
  if (value.length > MAX_DRIVE_URL) return { ok: false, error: "O link é muito longo." };
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return { ok: false, error: "Link inválido. Cole o link do Google Drive (começa com https://)." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Link inválido. Use um link http(s), como o do Google Drive." };
  }
  if (!parsed.hostname.includes(".")) {
    return { ok: false, error: "Link inválido. Cole o link completo do Google Drive." };
  }
  return { ok: true, url: parsed.toString() };
}

// Arquivo do Drive (…/file/d/ID/view, open?id=ID, uc?id=ID) → link que baixa
// direto; qualquer outro link (pasta, Docs, outro site) volta como está.
export function driveDownloadUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (parsed.hostname === "drive.google.com") {
    const byPath = parsed.pathname.match(/\/file\/d\/([\w-]+)/);
    const id = byPath?.[1] ?? parsed.searchParams.get("id");
    if (id && !parsed.pathname.startsWith("/drive/folders")) {
      return `https://drive.google.com/uc?export=download&id=${id}`;
    }
  }
  return parsed.toString();
}
