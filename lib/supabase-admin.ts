import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const DOCUMENTS_BUCKET = "process-documents";
export const LOGOS_BUCKET = "supplier-logos";

let cached: SupabaseClient | null = null;

// Cliente com a Service Role Key — só pode rodar em Server Actions/Server
// Components, nunca em código enviado ao browser. Usado exclusivamente para
// Supabase Storage (upload/signed URL); dados relacionais continuam via
// db/client.ts (Drizzle). Mesmo padrão lazy/Proxy de db/client.ts: só
// conecta no primeiro uso real, nunca no import, para não quebrar o
// "collecting page data" do Next build quando a env var ainda não existe.
function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não definidas. Preencha em .env.local (Project Settings > API no Supabase).",
    );
  }
  cached = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const instance = getSupabaseAdmin();
    return Reflect.get(instance as object, prop, receiver);
  },
});

// URL assinada de curta duração — nunca uma URL pública permanente, já que
// o bucket é privado.
export async function getSignedDocumentUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, 60);
  if (error || !data) return null;
  return data.signedUrl;
}
