import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { buildAuthUrl, getGoogleCredentials, GMAIL_STATE_COOKIE, gmailRedirectUri } from "@/lib/gmail";

export const dynamic = "force-dynamic";

// Inicia a conexão do Gmail da pessoa logada: manda para a tela de consentimento
// do Google (somente leitura). O "state" fica num cookie httpOnly e volta no callback.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.nextUrl.origin));

  const { clientId } = getGoogleCredentials();
  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(
    buildAuthUrl({
      clientId,
      redirectUri: gmailRedirectUri(request.nextUrl.origin),
      state,
    }),
  );
  response.cookies.set(GMAIL_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/api/gmail",
    maxAge: 60 * 10,
  });
  return response;
}
