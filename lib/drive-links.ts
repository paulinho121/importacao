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

function parse(url: string | null | undefined): URL | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

// ID do arquivo do Drive (…/file/d/ID/view, open?id=ID, uc?id=ID) — pasta não conta.
function driveFileId(u: URL): string | null {
  if (u.hostname !== "drive.google.com" || u.pathname.startsWith("/drive/folders")) return null;
  return u.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] ?? u.searchParams.get("id");
}

// Documento/planilha/apresentação do Google (docs.google.com/<tipo>/d/ID/...).
function googleDoc(u: URL): { type: "document" | "spreadsheets" | "presentation"; id: string } | null {
  if (u.hostname !== "docs.google.com") return null;
  const m = u.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([\w-]+)/);
  return m ? { type: m[1] as "document" | "spreadsheets" | "presentation", id: m[2] } : null;
}

// Link para BAIXAR: arquivo do Drive vira download direto; Planilha/Doc/Apresentação
// do Google são exportados (xlsx / pdf / pptx); qualquer outro link volta como está.
export function driveDownloadUrl(url: string | null | undefined): string | null {
  const u = parse(url);
  if (!u) return null;
  const id = driveFileId(u);
  if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  const doc = googleDoc(u);
  if (doc) {
    const format = doc.type === "spreadsheets" ? "xlsx" : doc.type === "document" ? "pdf" : "pptx";
    return doc.type === "presentation"
      ? `https://docs.google.com/presentation/d/${doc.id}/export/pptx`
      : `https://docs.google.com/${doc.type}/d/${doc.id}/export?format=${format}`;
  }
  return u.toString();
}

// Link para VISUALIZAR dentro da página (iframe), quando o Google permite:
// arquivo do Drive e documentos do Google têm a versão /preview. Pasta ou outro
// site: null (abre numa nova aba).
export function drivePreviewUrl(url: string | null | undefined): string | null {
  const u = parse(url);
  if (!u) return null;
  const id = driveFileId(u);
  if (id) return `https://drive.google.com/file/d/${id}/preview`;
  const doc = googleDoc(u);
  if (doc) return `https://docs.google.com/${doc.type}/d/${doc.id}/preview`;
  return null;
}

// Link para abrir numa nova aba (o visualizador do próprio Drive/Docs ou o link original).
export function driveOpenUrl(url: string | null | undefined): string | null {
  const u = parse(url);
  if (!u) return null;
  const id = driveFileId(u);
  return id ? `https://drive.google.com/file/d/${id}/view` : u.toString();
}
