import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { gmailConnections } from "@/db/schema";
import { syncGmailConnection } from "@/lib/gmail-sync";

export const dynamic = "force-dynamic";
// Limite do plano da Vercel para funções; a rodada para antes do fim (ver deadline).
export const maxDuration = 60;

// Chamada pelo cron da Vercel (vercel.json). A Vercel envia
// "Authorization: Bearer <CRON_SECRET>" quando a variável existe no projeto.
// Esta rota fica fora do login do proxy porque o cron não tem cookie de sessão.
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET não configurada" }, { status: 500 });
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "não autorizado" }, { status: 401 });
  }

  const deadlineMs = Date.now() + 40_000; // folga para o último lote dentro de maxDuration
  const connections = await db.select().from(gmailConnections);

  let imported = 0;
  let reconnect = 0;
  let failed = 0;
  let skipped = 0;
  for (const [index, connection] of connections.entries()) {
    if (Date.now() >= deadlineMs) {
      skipped = connections.length - index;
      break;
    }
    const outcome = await syncGmailConnection(connection, { deadlineMs });
    imported += outcome.imported;
    if (outcome.needsReconnect) reconnect++;
    if (!outcome.ok && !outcome.needsReconnect) failed++;
  }

  return NextResponse.json({
    ok: true,
    connections: connections.length,
    imported,
    needsReconnect: reconnect,
    failed,
    skipped,
  });
}
