import { createBrowserClient } from "@supabase/ssr";

// Cliente Supabase Auth pro browser — usado só em Header/Sidebar pra ler
// a sessão atual e mostrar o usuário real (substitui o "Logistics
// Manager" fixo). Sign-in/sign-out continuam via Server Action.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
