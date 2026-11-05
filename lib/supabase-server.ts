import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";

// Cliente Supabase Auth pra Server Components/Actions — lê/escreve a
// sessão via cookies (next/headers). Usado só pra autenticação; dados
// relacionais continuam via Drizzle (db/client.ts), nunca por aqui.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Component chamando setAll (não pode escrever cookie) —
            // ignorado de propósito, o middleware já cuida de renovar a
            // sessão a cada request.
          }
        },
      },
    },
  );
}

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "OPERADOR";
};

// Usuário autenticado + perfil (profiles), ou null se não estiver logado.
// cache(): dentro de uma mesma requisição (página + ações + componentes) o
// usuário é resolvido uma única vez, em vez de uma ida ao Auth e uma ao banco
// por chamada. getClaims valida o JWT localmente, sem viagem de rede.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId));
  if (!profile) return null;

  return { id: profile.id, email: profile.email, name: profile.name, role: profile.role };
});

// Usado no topo de Financeiro/Configurações — manda pra "/" quem não for
// Admin (o middleware já garante que o usuário está logado antes disso).
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/");
  return user;
}
