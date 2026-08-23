"use server";

import { getCurrentUser, type CurrentUser } from "@/lib/supabase-server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

// Chamada direto do client (Header/Sidebar) pra saber quem está logado —
// profiles fica só no Postgres via Drizzle, o cliente Supabase do browser
// não alcança essa tabela sozinho.
export async function getCurrentUserAction(): Promise<CurrentUser | null> {
  return getCurrentUser();
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
