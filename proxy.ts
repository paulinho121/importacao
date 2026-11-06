import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Renova a sessão a cada request e bloqueia rota sem login. Padrão oficial
// do @supabase/ssr pra Next App Router — cookies precisam ser lidos E
// reescritos aqui (não só em lib/supabase-server.ts) porque é o único
// lugar que roda antes de QUALQUER página renderizar. Next 16 renomeou o
// arquivo (e a função exportada) de "middleware" pra "proxy".
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Roda em toda rota, exceto assets estáticos/Next internals e o
    // Material Symbols (link externo, não passa por aqui de qualquer
    // forma) — mesmo padrão recomendado pela documentação do Supabase.
    // manifest.webmanifest também fica de fora: o navegador busca o manifesto SEM
    // cookies, e sem isso o login o redirecionava para /login (HTML), gerando o
    // erro "Manifest: Line 1, column 1, Syntax error" no console a cada página.
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
