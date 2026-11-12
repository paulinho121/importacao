"use server";

import { db } from "@/db/client";
import {
  processEvents,
  processQuoteEvents,
  processSupplierQuoteItems,
  processSupplierQuotes,
  suppliers,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withFlash } from "@/lib/flash";
import { supabaseAdmin, DOCUMENTS_BUCKET } from "@/lib/supabase-admin";
import { normalizeDriveUrl } from "@/lib/drive-links";
import { formatMoney } from "@/lib/freight-quotes";
import { quoteActorName, recordQuoteEvents } from "@/lib/quote-history";
import { changeLine, fmtDate, sameNumber } from "@/lib/quote-events";
import {
  MAX_SUPPLIER_QUOTE_ITEMS,
  isSupplierQuoteStatus,
  supplierItemTotal,
  supplierQuoteStatusLabel,
} from "@/lib/supplier-quotes";

// Cotação com o fornecedor. Totalmente independente da cotação do agente de
// cargas: nada aqui exige (nem altera) a outra.

const CURRENCIES = ["USD", "EUR", "CNY", "GBP", "JPY", "OTHER", "BRL"] as const;
type Currency = (typeof CURRENCIES)[number];
const FILE_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "xlsx", "xls", "csv", "doc", "docx"];
const MAX_FILE_BYTES = 4 * 1024 * 1024; // limite do corpo de Server Action na Vercel

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() || null;
}

// Aceita "1234.56" e "1.234,56"; vazio = null; inválido = NaN.
function parseNumber(raw: FormDataEntryValue | null | undefined): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : Number.NaN;
}

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_");
}

const fixed = (n: number | null, digits: number) => (n === null ? null : n.toFixed(digits));

export type SupplierSaveResult =
  | { ok: true; id: string; created: boolean; fileName: string | null }
  | { ok: false; error: string };

const fail = (error: string): SupplierSaveResult => ({ ok: false, error });

type QuoteRow = typeof processSupplierQuotes.$inferSelect;

function moneyText(currency: string, total: string | number | null | undefined): string {
  return total === null || total === undefined || total === "" ? "—" : formatMoney(Number(total), currency);
}

export async function saveSupplierQuote(
  processId: string,
  quoteId: string | null,
  formData: FormData,
): Promise<SupplierSaveResult> {
  const back = `/processos/${processId}`;

  const supplierId = text(formData, "supplierId");
  if (!supplierId) return fail("Escolha o fornecedor da cotação.");
  const [supplier] = await db.select({ name: suppliers.name }).from(suppliers).where(eq(suppliers.id, supplierId));
  if (!supplier) return fail("Fornecedor não encontrado.");

  const statusRaw = text(formData, "status") ?? "";
  const status = isSupplierQuoteStatus(statusRaw) ? statusRaw : "SOLICITADA";
  const currencyRaw = String(formData.get("currency") ?? "");
  const currency: Currency = (CURRENCIES as readonly string[]).includes(currencyRaw) ? (currencyRaw as Currency) : "USD";

  const typedTotal = parseNumber(formData.get("totalValue"));
  const productionDays = parseNumber(formData.get("productionDays"));
  if (typedTotal !== null && (Number.isNaN(typedTotal) || typedTotal < 0)) {
    return fail("Confira o valor total: use só números, sem negativos.");
  }
  if (productionDays !== null && (Number.isNaN(productionDays) || !Number.isInteger(productionDays) || productionDays < 0)) {
    return fail("O prazo de produção deve ser um número inteiro de dias.");
  }
  const quoteDate = text(formData, "quoteDate");
  const validUntil = text(formData, "validUntil");
  if ([quoteDate, validUntil].some((d) => d !== null && !/^\d{4}-\d{2}-\d{2}$/.test(d))) {
    return fail("Confira as datas da cotação.");
  }
  if (quoteDate && validUntil && validUntil < quoteDate) {
    return fail("A validade não pode ser anterior à data da cotação.");
  }

  // Itens (opcional): campos paralelos, um de cada por linha.
  const skus = formData.getAll("itemSku").map((v) => String(v).trim());
  const descriptions = formData.getAll("itemDescription").map((v) => String(v).trim());
  const quantities = formData.getAll("itemQuantity");
  const unitPrices = formData.getAll("itemUnitPrice");
  const itemTotals = formData.getAll("itemTotal");
  const items: (typeof processSupplierQuoteItems.$inferInsert)[] = [];
  for (let i = 0; i < descriptions.length; i++) {
    const quantity = parseNumber(quantities[i]);
    const unitPrice = parseNumber(unitPrices[i]);
    const itemTotal = parseNumber(itemTotals[i]);
    const description = descriptions[i] ?? "";
    const sku = skus[i] ?? "";
    if (!description && !sku && quantity === null && unitPrice === null && itemTotal === null) continue;
    const label = `Item "${description || sku || i + 1}"`;
    if (!description) return fail(`${label}: informe a descrição do item.`);
    if ([quantity, unitPrice, itemTotal].some((n) => n !== null && (Number.isNaN(n) || n < 0))) {
      return fail(`${label}: use só números, sem valores negativos.`);
    }
    const total = itemTotal ?? supplierItemTotal(quantity, unitPrice);
    if (total === null) return fail(`${label}: informe o total (ou quantidade e preço unitário).`);
    items.push({
      quoteId: quoteId ?? "", // preenchido na gravação
      position: items.length,
      sku: sku || null,
      description,
      quantity: fixed(quantity, 3),
      unitPrice: fixed(unitPrice, 4),
      total: total.toFixed(2),
    });
  }
  if (items.length > MAX_SUPPLIER_QUOTE_ITEMS) {
    return fail(`No máximo ${MAX_SUPPLIER_QUOTE_ITEMS} itens por cotação.`);
  }
  // Sem total digitado, o total é a soma dos itens.
  const itemsSum = items.reduce((s, it) => s + Number(it.total), 0);
  const totalValue = typedTotal ?? (items.length > 0 ? Math.round(itemsSum * 100) / 100 : null);

  const drive = normalizeDriveUrl(String(formData.get("driveUrl") ?? ""));
  if (!drive.ok) return fail(drive.error);

  // Arquivo da cotação (opcional), até 4 MB.
  const fileEntry = formData.get("file");
  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;
  if (file) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!FILE_EXTENSIONS.includes(ext)) {
      return fail("O arquivo da cotação deve ser PDF, imagem (PNG/JPG), planilha ou documento do Word.");
    }
    if (file.size > MAX_FILE_BYTES) return fail("O arquivo passa de 4 MB. Reduza ou comprima e tente de novo.");
  }
  const removeFile = formData.get("removeFile") === "1";

  const values = {
    supplierId,
    proposal: text(formData, "proposal"),
    quoteDate,
    validUntil,
    status,
    currency,
    totalValue: fixed(totalValue, 2),
    incoterm: text(formData, "incoterm"),
    commercialTerms: text(formData, "commercialTerms"),
    paymentTerms: text(formData, "paymentTerms"),
    productionDays,
    driveUrl: drive.url,
    notes: text(formData, "notes"),
  };

  let existing: QuoteRow | undefined;
  let existingItems: { total: string }[] = [];
  let existingSupplierName: string | null = null;
  if (quoteId) {
    [existing] = await db
      .select()
      .from(processSupplierQuotes)
      .where(and(eq(processSupplierQuotes.id, quoteId), eq(processSupplierQuotes.processId, processId)));
    if (!existing) return fail("Cotação não encontrada.");
    existingItems = await db
      .select({ total: processSupplierQuoteItems.total })
      .from(processSupplierQuoteItems)
      .where(eq(processSupplierQuoteItems.quoteId, quoteId));
    if (existing.supplierId === supplierId) existingSupplierName = supplier.name;
    else if (existing.supplierId) {
      const [old] = await db.select({ name: suppliers.name }).from(suppliers).where(eq(suppliers.id, existing.supplierId));
      existingSupplierName = old?.name ?? null;
    }
  }
  const actor = await quoteActorName();

  // Upload antes de gravar; se o banco falhar depois, o arquivo órfão é removido.
  let uploaded: { fileName: string; storagePath: string } | null = null;
  if (file) {
    const path = `cotacoes-fornecedor/${processId}/${Date.now()}-${safeFileName(file.name)}`;
    const { error } = await supabaseAdmin.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (error) return fail(`Falha no upload de ${file.name}: ${error.message}`);
    uploaded = { fileName: file.name, storagePath: path };
  }

  let failed = false;
  let savedId: string | null = quoteId;
  try {
    await db.transaction(async (tx) => {
      const filePatch = uploaded
        ? { fileName: uploaded.fileName, storagePath: uploaded.storagePath }
        : removeFile
          ? { fileName: null, storagePath: null }
          : {};
      let id = quoteId;
      if (id) {
        await tx
          .update(processSupplierQuotes)
          .set({ ...values, ...filePatch, updatedAt: new Date() })
          .where(eq(processSupplierQuotes.id, id));
        await tx.delete(processSupplierQuoteItems).where(eq(processSupplierQuoteItems.quoteId, id));
      } else {
        const [created] = await tx
          .insert(processSupplierQuotes)
          .values({ processId, ...values, ...filePatch })
          .returning({ id: processSupplierQuotes.id });
        id = created.id;
        await tx.insert(processEvents).values({
          processId,
          eventDate: new Date(),
          eventType: `Cotação com o fornecedor adicionada: ${supplier.name}`,
          origin: `Cotação · ${actor}`,
        });
      }
      savedId = id;
      if (items.length > 0) {
        await tx.insert(processSupplierQuoteItems).values(items.map((it) => ({ ...it, quoteId: id! })));
      }

      // Aprovar a cotação do fornecedor fica registrado no histórico do processo
      // (não mexe em nada do frete).
      if (status === "APROVADA" && existing?.status !== "APROVADA") {
        await tx.insert(processEvents).values({
          processId,
          eventDate: new Date(),
          eventType: `Cotação do fornecedor aprovada: ${supplier.name}${
            totalValue !== null ? ` · ${formatMoney(totalValue, currency)}` : ""
          }`,
          origin: `Cotação · ${actor}`,
        });
      }

      const descriptions = existing
        ? supplierChangeDescriptions({
            before: existing,
            beforeSupplierName: existingSupplierName,
            beforeItems: existingItems,
            after: values,
            afterSupplierName: supplier.name,
            afterItems: items,
            uploadedFileName: uploaded?.fileName ?? null,
            removedFile: removeFile && !uploaded && Boolean(existing.fileName),
          })
        : [
            `Cotação criada (${supplier.name}) · situação ${supplierQuoteStatusLabel(status)}`,
            ...(totalValue !== null ? [`Valor informado: ${formatMoney(totalValue, currency)}`] : []),
            ...(values.productionDays !== null ? [`Prazo de produção: ${values.productionDays} dias`] : []),
            ...(values.paymentTerms ? [`Pagamento: ${values.paymentTerms}`] : []),
            ...(drive.url ? ["Link do Drive adicionado"] : []),
            ...(uploaded ? [`Arquivo anexado: ${uploaded.fileName}`] : []),
          ];
      await recordQuoteEvents(tx, { processId, quoteType: "SUPPLIER", quoteId: id, descriptions, actor });
    });
  } catch (e) {
    failed = true;
    console.error("saveSupplierQuote falhou", e);
    if (uploaded) await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).remove([uploaded.storagePath]);
  }
  if (failed) return fail("Não foi possível salvar a cotação. Tente novamente.");

  // Arquivo antigo substituído/removido: apaga do Storage.
  if (existing?.storagePath && (uploaded || removeFile)) {
    await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).remove([existing.storagePath]);
  }

  revalidatePath(back);
  return {
    ok: true,
    id: savedId!,
    created: !quoteId,
    fileName: uploaded ? uploaded.fileName : removeFile ? null : (existing?.fileName ?? null),
  };
}

export async function deleteSupplierQuote(quoteId: string, processId: string) {
  const back = `/processos/${processId}`;
  const actor = await quoteActorName();
  const [quote] = await db
    .select({ storagePath: processSupplierQuotes.storagePath })
    .from(processSupplierQuotes)
    .where(and(eq(processSupplierQuotes.id, quoteId), eq(processSupplierQuotes.processId, processId)));
  if (quote) {
    await db.transaction(async (tx) => {
      await tx.delete(processSupplierQuotes).where(eq(processSupplierQuotes.id, quoteId));
      // o histórico da cotação some junto; fica o registro no histórico do processo
      await tx
        .delete(processQuoteEvents)
        .where(and(eq(processQuoteEvents.quoteType, "SUPPLIER"), eq(processQuoteEvents.quoteId, quoteId)));
      await tx.insert(processEvents).values({
        processId,
        eventDate: new Date(),
        eventType: "Cotação com o fornecedor removida",
        origin: `Cotação · ${actor}`,
      });
    });
    if (quote.storagePath) await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).remove([quote.storagePath]);
  }
  revalidatePath(back);
  redirect(withFlash(back, "Cotação do fornecedor removida."));
}

// O que mudou entre a cotação gravada e a que está sendo salva.
function supplierChangeDescriptions(p: {
  before: QuoteRow;
  beforeSupplierName: string | null;
  beforeItems: { total: string }[];
  after: {
    supplierId: string;
    proposal: string | null;
    quoteDate: string | null;
    validUntil: string | null;
    status: string;
    currency: string;
    totalValue: string | null;
    incoterm: string | null;
    commercialTerms: string | null;
    paymentTerms: string | null;
    productionDays: number | null;
    driveUrl: string | null;
    notes: string | null;
  };
  afterSupplierName: string;
  afterItems: { total?: string }[];
  uploadedFileName: string | null;
  removedFile: boolean;
}): string[] {
  const { before, after } = p;
  const out: (string | null)[] = [];
  out.push(changeLine("Situação", supplierQuoteStatusLabel(before.status), supplierQuoteStatusLabel(after.status)));
  if (before.supplierId !== after.supplierId) out.push(changeLine("Fornecedor", p.beforeSupplierName, p.afterSupplierName));
  if (!sameNumber(before.totalValue, after.totalValue) || before.currency !== after.currency) {
    out.push(`Valor total: ${moneyText(before.currency, before.totalValue)} → ${moneyText(after.currency, after.totalValue)}`);
  }
  const sum = (rows: { total?: string }[]) => Math.round(rows.reduce((s, r) => s + Number(r.total ?? 0), 0) * 100) / 100;
  if (p.beforeItems.length !== p.afterItems.length || sum(p.beforeItems) !== sum(p.afterItems)) {
    out.push(`Valores por item alterados (${p.beforeItems.length} → ${p.afterItems.length} itens)`);
  }
  if (before.productionDays !== after.productionDays) {
    out.push(
      `Prazo de produção: ${before.productionDays !== null ? `${before.productionDays} dias` : "—"} → ${
        after.productionDays !== null ? `${after.productionDays} dias` : "—"
      }`,
    );
  }
  if ((before.validUntil ?? null) !== after.validUntil) {
    out.push(`Validade: ${fmtDate(before.validUntil)} → ${fmtDate(after.validUntil)}`);
  }
  if ((before.quoteDate ?? null) !== after.quoteDate) {
    out.push(`Data da cotação: ${fmtDate(before.quoteDate)} → ${fmtDate(after.quoteDate)}`);
  }
  out.push(changeLine("Nº da proposta", before.proposal, after.proposal));
  out.push(changeLine("Incoterm", before.incoterm, after.incoterm));
  out.push(changeLine("Pagamento", before.paymentTerms, after.paymentTerms));
  if ((before.commercialTerms ?? "").trim() !== (after.commercialTerms ?? "").trim()) out.push("Condições comerciais alteradas");
  if ((before.notes ?? "").trim() !== (after.notes ?? "").trim()) out.push("Observação alterada");
  if ((before.driveUrl ?? null) !== after.driveUrl) {
    out.push(!after.driveUrl ? "Link do Drive removido" : before.driveUrl ? "Link do Drive alterado" : "Link do Drive adicionado");
  }
  if (p.uploadedFileName) out.push(`Arquivo anexado: ${p.uploadedFileName}`);
  if (p.removedFile) out.push("Arquivo removido");
  return out.filter((v): v is string => Boolean(v));
}
