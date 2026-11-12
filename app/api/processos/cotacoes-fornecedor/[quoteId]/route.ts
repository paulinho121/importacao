import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { processSupplierQuotes } from "@/db/schema";
import { supabaseAdmin, DOCUMENTS_BUCKET } from "@/lib/supabase-admin";

// Entrega o arquivo da cotação do fornecedor anexado a uma cotação, pelo próprio
// app (o visualizador da tela lê daqui; `?download=1` força o download). O
// login é exigido pelo proxy.ts, que cobre todas as rotas.

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  csv: "text/csv; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export async function GET(request: Request, ctx: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(quoteId)) return new Response("Arquivo não encontrado.", { status: 404 });

  const [quote] = await db
    .select({ fileName: processSupplierQuotes.fileName, storagePath: processSupplierQuotes.storagePath })
    .from(processSupplierQuotes)
    .where(eq(processSupplierQuotes.id, quoteId));
  if (!quote?.storagePath || !quote.fileName) return new Response("Arquivo não encontrado.", { status: 404 });

  const { data, error } = await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).download(quote.storagePath);
  if (error || !data) return new Response("Não foi possível abrir o arquivo.", { status: 502 });

  const ext = quote.fileName.split(".").pop()?.toLowerCase() ?? "";
  const known = CONTENT_TYPES[ext];
  const asDownload = new URL(request.url).searchParams.get("download") === "1" || !known;
  const disposition = `${asDownload ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(quote.fileName)}`;

  return new Response(await data.arrayBuffer(), {
    headers: {
      "Content-Type": known ?? "application/octet-stream",
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
