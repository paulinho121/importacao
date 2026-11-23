import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { gmailConnections } from "@/db/schema";
import { getCurrentUser } from "@/lib/supabase-server";
import {
  exchangeCodeForTokens,
  getMailboxAddress,
  GMAIL_STATE_COOKIE,
  gmailRedirectUri,
  GmailApiError,
} from "@/lib/gmail";
import { syncGmailConnection } from "@/lib/gmail-sync";
import { withFlash, withFlashError } from "@/lib/flash";

export const dynamic = "force-dynamic";
// A primeira sincronização roda aqui com teto de 20 s; o restante fica para a próxima rodada.
export const maxDuration = 60;

// Troca o código do Google pelo token e guarda a conexão da pessoa logada.
// O token nunca aparece na URL, nos logs nem na tela.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;
  const expectedState = (await cookies()).get(GMAIL_STATE_COOKIE)?.value;

  const finish = (path: string) => {
    const response = NextResponse.redirect(new URL(path, origin));
    // O state é de uso único: apaga o cookie em qualquer desfecho.
    response.cookies.set(GMAIL_STATE_COOKIE, "", { path: "/api/gmail", maxAge: 0 });
    return response;
  };

  if (params.get("error")) {
    return finish(withFlashError("/emails", "Conexão com o Gmail cancelada."));
  }

  const state = params.get("state");
  const code = params.get("code");
  if (!expectedState || !state || state !== expectedState || !code) {
    return finish(withFlashError("/emails", "Sessão de conexão inválida ou expirada. Tente conectar de novo."));
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));

  try {
    const tokens = await exchangeCodeForTokens(code, gmailRedirectUri(origin));
    if (!tokens.refreshToken) {
      return finish(
        withFlashError("/emails", "O Google não liberou o acesso contínuo. Tente conectar de novo e aceite as permissões."),
      );
    }

    const googleEmail = await getMailboxAddress(tokens.accessToken);
    const values = {
      googleEmail,
      refreshToken: tokens.refreshToken,
      connectedAt: new Date(),
      lastSyncedAt: null,
      lastSyncError: null,
    };
    await db
      .insert(gmailConnections)
      .values({ userId: user.id, ...values })
      .onConflictDoUpdate({ target: gmailConnections.userId, set: values });

    const [connection] = await db.select().from(gmailConnections).where(eq(gmailConnections.userId, user.id));
    const outcome = await syncGmailConnection(connection, { deadlineMs: Date.now() + 20_000 });
    return finish(withFlash("/emails", `Gmail conectado (${googleEmail}). ${outcome.message}`));
  } catch (e) {
    console.error("Gmail: falha ao concluir a conexão", e instanceof GmailApiError ? `HTTP ${e.status}` : "erro");
    return finish(withFlashError("/emails", "Não foi possível concluir a conexão com o Gmail. Tente de novo."));
  }
}
