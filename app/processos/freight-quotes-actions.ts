"use server";

import { db } from "@/db/client";
import {
  freightAgents,
  processEvents,
  processFreightQuoteLines,
  processFreightQuotes,
  processQuoteEvents,
  processes,
} from "@/db/schema";
import { and, asc, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withFlash, withFlashError } from "@/lib/flash";
import { supabaseAdmin, DOCUMENTS_BUCKET } from "@/lib/supabase-admin";
import {
  computeLineTotal,
  freightToApply,
  formatMoney,
  isQuoteStatus,
  QUOTE_SECTIONS,
  type QuoteSection,
} from "@/lib/freight-quotes";
import { MODALIDADES, TIPOS_EMBARQUE, modalFromTipo } from "@/lib/modais";
import { fetchPtaxRate, type PtaxCurrency } from "@/lib/ptax";
import { normalizeDriveUrl } from "@/lib/drive-links";
import { quoteActorName, recordQuoteEvents } from "@/lib/quote-history";
import { changeLine, fmtDate, fmtText, sameNumber } from "@/lib/quote-events";

const CURRENCIES = ["USD", "EUR", "CNY", "GBP", "JPY", "OTHER", "BRL"] as const;
const MODALS = ["AIR", "SEA_FCL", "SEA_LCL", "SEA_BREAK_BULK", "SEA_RORO", "COURIER", "ROAD"] as const;
const UNITS = ["KG", "HAWB", "PROCESSO", "CONTAINER", "VOLUME", "PERCENT", "FIXO"];
const FILE_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "xlsx", "xls", "csv"];
const MAX_FILE_BYTES = 4 * 1024 * 1024; // limite do corpo de Server Action na Vercel
type Currency = (typeof CURRENCIES)[number];
type Modal = (typeof MODALS)[number];

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

function parseInt0(raw: FormDataEntryValue | null | undefined): number | null {
  const n = parseNumber(raw);
  if (n === null) return null;
  return Number.isInteger(n) && n >= 0 ? n : Number.NaN;
}

function asCurrency(v: FormDataEntryValue | null | undefined, fallback: Currency): Currency {
  const s = String(v ?? "");
  return (CURRENCIES as readonly string[]).includes(s) ? (s as Currency) : fallback;
}

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_");
}

const FREIGHT_STATUS_LABEL: Record<string, string> = { ATUALIZADO: "Atualizado", ANTIGO: "Antigo", FECHADO: "Fechado" };
const statusLabel = (s: string) => FREIGHT_STATUS_LABEL[s] ?? s;

// "BRL 10,00 + USD 100,00" (moedas em ordem alfabética, para comparar antes/depois).
function totalsText(lines: { currency?: string; total: string | number }[]): string {
  const sums = new Map<string, number>();
  for (const l of lines) {
    const c = l.currency ?? "USD";
    sums.set(c, (sums.get(c) ?? 0) + Number(l.total));
  }
  return [...sums.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, value]) => formatMoney(Math.round(value * 100) / 100, currency))
    .join(" + ");
}

type FreightFields = Partial<typeof processFreightQuotes.$inferInsert>;

const FREIGHT_TEXT_FIELDS: [keyof FreightFields, string][] = [
  ["proposal", "Nº da proposta"],
  ["modalidade", "Modal"],
  ["containerType", "Tipo de embarque"],
  ["incoterm", "Incoterm"],
  ["origin", "Origem"],
  ["destination", "Destino"],
  ["carrier", "Cia / armador"],
  ["route", "Rota"],
  ["frequency", "Frequência"],
  ["cargoDescription", "Mercadoria"],
  ["dimensions", "Dimensões"],
  ["pickupAddress", "Coleta"],
  ["notes", "Observação"],
];
const FREIGHT_DATE_FIELDS: [keyof FreightFields, string][] = [
  ["etdEstimated", "Embarque previsto (ETD)"],
  ["etaEstimated", "Chegada prevista (ETA)"],
  ["validUntil", "Validade"],
  ["quoteDate", "Data da cotação"],
];
const FREIGHT_NUMBER_FIELDS: [keyof FreightFields, string][] = [
  ["transitDays", "Trânsito mínimo (dias)"],
  ["transitDaysMax", "Trânsito máximo (dias)"],
  ["grossWeightKg", "Peso considerado (kg)"],
  ["volumes", "Volumes"],
  ["volumeM3", "Volume (m³)"],
  ["cargoValue", "Valor da carga"],
];

// O que mudou entre a cotação gravada e a que está sendo salva, em frases
// curtas para o histórico.
function freightChangeDescriptions(p: {
  before: FreightFields;
  beforeAgentName: string | null;
  beforeLines: { currency: string; total: string }[];
  after: FreightFields;
  afterAgentName: string;
  afterLines: { currency?: string; total: string }[];
  uploadedFileName: string | null;
  removedFile: boolean;
}): string[] {
  const out: (string | null)[] = [];
  const { before, after } = p;
  out.push(changeLine("Situação", statusLabel(before.status ?? ""), statusLabel(after.status ?? "")));
  if (before.agentId !== after.agentId) out.push(changeLine("Agente de cargas", p.beforeAgentName, p.afterAgentName));
  const totalsBefore = totalsText(p.beforeLines);
  const totalsAfter = totalsText(p.afterLines);
  out.push(changeLine("Valores", totalsBefore, totalsAfter));
  for (const [key, label] of FREIGHT_DATE_FIELDS) {
    const b = (before[key] as string | null | undefined) ?? null;
    const a = (after[key] as string | null | undefined) ?? null;
    if (b !== a) out.push(`${label}: ${fmtDate(b)} → ${fmtDate(a)}`);
  }
  for (const [key, label] of FREIGHT_NUMBER_FIELDS) {
    const b = before[key] as string | number | null | undefined;
    const a = after[key] as string | number | null | undefined;
    if (!sameNumber(b, a)) out.push(`${label}: ${fmtText(b === null || b === undefined ? null : String(Number(b)))} → ${fmtText(a === null || a === undefined ? null : String(Number(a)))}`);
  }
  for (const [key, label] of FREIGHT_TEXT_FIELDS) {
    if (key === "notes") {
      if ((before.notes ?? "").trim() !== (after.notes ?? "").trim()) out.push("Observação alterada");
      continue;
    }
    out.push(changeLine(label, before[key] as string | null, after[key] as string | null));
  }
  if ((before.driveUrl ?? null) !== (after.driveUrl ?? null)) {
    out.push(!after.driveUrl ? "Link do Drive removido" : before.driveUrl ? "Link do Drive alterado" : "Link do Drive adicionado");
  }
  if (p.uploadedFileName) out.push(`Arquivo anexado: ${p.uploadedFileName}`);
  if (p.removedFile) out.push("Arquivo removido");
  const result = out.filter((v): v is string => Boolean(v));
  return result;
}

export type SaveResult =
  | { ok: true; id: string; created: boolean; fileName: string | null }
  | { ok: false; error: string };

const fail = (error: string): SaveResult => ({ ok: false, error });

const fixed = (n: number | null, digits: number) => (n === null ? null : n.toFixed(digits));

export async function saveFreightQuote(
  processId: string,
  quoteId: string | null,
  formData: FormData,
): Promise<SaveResult> {
  const back = `/processos/${processId}`;

  const agentId = text(formData, "agentId");
  if (!agentId) return fail("Escolha o agente de carga da cotação.");
  const [agent] = await db.select({ name: freightAgents.name }).from(freightAgents).where(eq(freightAgents.id, agentId));
  if (!agent) return fail("Agente de carga não encontrado.");

  const transitDays = parseInt0(formData.get("transitDays"));
  const transitDaysMax = parseInt0(formData.get("transitDaysMax"));
  const volumes = parseInt0(formData.get("volumes"));
  const grossWeightKg = parseNumber(formData.get("grossWeightKg"));
  const volumeM3 = parseNumber(formData.get("volumeM3"));
  const cargoValue = parseNumber(formData.get("cargoValue"));
  if ([transitDays, transitDaysMax, volumes].some((n) => Number.isNaN(n))) {
    return fail("Trânsito e volumes devem ser números inteiros.");
  }
  if ([grossWeightKg, volumeM3, cargoValue].some((n) => n !== null && (Number.isNaN(n) || n < 0))) {
    return fail("Confira peso, volume e valor da mercadoria: use só números, sem negativos.");
  }
  if (transitDays !== null && transitDaysMax !== null && transitDaysMax < transitDays) {
    return fail("O trânsito máximo não pode ser menor que o mínimo.");
  }
  const etdEstimated = text(formData, "etdEstimated");
  const etaEstimated = text(formData, "etaEstimated");
  if ([etdEstimated, etaEstimated].some((d) => d !== null && !/^\d{4}-\d{2}-\d{2}$/.test(d))) {
    return fail("Confira as datas de embarque e chegada previstas.");
  }
  if (etdEstimated && etaEstimated && etaEstimated < etdEstimated) {
    return fail("A chegada prevista (ETA) não pode ser antes do embarque previsto (ETD).");
  }

  // Linhas de valor: campos paralelos (um de cada por linha do formulário).
  const sections = formData.getAll("lineSection").map(String);
  const descriptions = formData.getAll("lineDescription").map((v) => String(v).trim());
  const quantities = formData.getAll("lineQuantity");
  const unitPrices = formData.getAll("lineUnitPrice");
  const lineUnits = formData.getAll("lineUnit").map(String);
  const minimums = formData.getAll("lineMinimum");
  const lineCurrencies = formData.getAll("lineCurrency");
  const lineTotals = formData.getAll("lineTotal");

  const validSections = QUOTE_SECTIONS.map((s) => s.value) as string[];
  const lines: (typeof processFreightQuoteLines.$inferInsert)[] = [];
  for (let i = 0; i < sections.length; i++) {
    const quantity = parseNumber(quantities[i]);
    const unitPrice = parseNumber(unitPrices[i]);
    const minimum = parseNumber(minimums[i]);
    const typedTotal = parseNumber(lineTotals[i]);
    const description = descriptions[i] ?? "";
    // Linha em branco (o usuário abriu e não preencheu): ignora.
    if (!description && quantity === null && unitPrice === null && minimum === null && typedTotal === null) continue;
    const label = `Linha "${description || `${i + 1}`}"`;
    if (!validSections.includes(sections[i])) continue;
    if (!description) return fail(`${label}: informe a descrição da despesa.`);
    if ([quantity, unitPrice, minimum, typedTotal].some((n) => n !== null && (Number.isNaN(n) || n < 0))) {
      return fail(`${label}: use só números, sem valores negativos.`);
    }
    const total = typedTotal ?? computeLineTotal(quantity, unitPrice, minimum);
    if (total === null) return fail(`${label}: informe o total (ou quantidade e tarifa).`);
    const unit = UNITS.includes(lineUnits[i]) ? lineUnits[i] : null;
    lines.push({
      quoteId: quoteId ?? "", // preenchido na gravação
      section: sections[i] as QuoteSection,
      position: lines.length,
      description,
      quantity: fixed(quantity, 3),
      unitPrice: fixed(unitPrice, 4),
      unit,
      minimum: fixed(minimum, 2),
      currency: asCurrency(lineCurrencies[i], "USD"),
      total: total.toFixed(2),
    });
  }

  // Arquivo da proposta (opcional): PDF, imagem ou planilha, até 4 MB.
  const fileEntry = formData.get("file");
  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;
  if (file) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!FILE_EXTENSIONS.includes(ext)) {
      return fail("O arquivo da proposta deve ser PDF, imagem (PNG/JPG) ou planilha.");
    }
    if (file.size > MAX_FILE_BYTES) {
      return fail("O arquivo passa de 4 MB. Reduza ou comprima e tente de novo.");
    }
  }
  const removeFile = formData.get("removeFile") === "1";

  // Modalidade (Marítimo/Aéreo/Terrestre) e tipo de embarque (FCL, LCL, Air
  // Cargo…); o enum `modal` é derivado deles.
  const modalidadeRaw = text(formData, "modalidade");
  const modalidade = MODALIDADES.some((m) => m.value === modalidadeRaw) ? modalidadeRaw : null;
  const tipoRaw = text(formData, "containerType");
  const containerType = TIPOS_EMBARQUE.some((t) => t.value === tipoRaw) ? tipoRaw : null;
  const modalFromChoice =
    modalFromTipo(containerType) ?? (modalidade === "AEREO" ? "AIR" : modalidade === "TERRESTRE" ? "ROAD" : null);
  const drive = normalizeDriveUrl(String(formData.get("driveUrl") ?? ""));
  if (!drive.ok) return fail(drive.error);
  const statusRaw = text(formData, "status") ?? "";
  const status = isQuoteStatus(statusRaw) ? statusRaw : "ATUALIZADO";
  const cargoCurrencyRaw = text(formData, "cargoValueCurrency");
  const values = {
    agentId,
    proposal: text(formData, "proposal"),
    driveUrl: drive.url,
    quoteDate: text(formData, "quoteDate"),
    validUntil: text(formData, "validUntil"),
    modal: modalFromChoice && (MODALS as readonly string[]).includes(modalFromChoice) ? (modalFromChoice as Modal) : null,
    modalidade,
    containerType,
    status,
    incoterm: text(formData, "incoterm"),
    carrier: text(formData, "carrier"),
    origin: text(formData, "origin"),
    destination: text(formData, "destination"),
    route: text(formData, "route"),
    transitDays,
    transitDaysMax,
    etdEstimated,
    etaEstimated,
    frequency: text(formData, "frequency"),
    cargoDescription: text(formData, "cargoDescription"),
    grossWeightKg: fixed(grossWeightKg, 2),
    volumes,
    volumeM3: fixed(volumeM3, 3),
    dimensions: text(formData, "dimensions"),
    cargoValue: fixed(cargoValue, 2),
    cargoValueCurrency: cargoValue !== null ? asCurrency(cargoCurrencyRaw, "USD") : null,
    pickupAddress: text(formData, "pickupAddress"),
    notes: text(formData, "notes"),
  };

  let existing: typeof processFreightQuotes.$inferSelect | undefined;
  let existingLines: { currency: string; total: string }[] = [];
  let existingAgentName: string | null = null;
  if (quoteId) {
    [existing] = await db
      .select()
      .from(processFreightQuotes)
      .where(and(eq(processFreightQuotes.id, quoteId), eq(processFreightQuotes.processId, processId)));
    if (!existing) return fail("Cotação não encontrada.");
    existingLines = await db
      .select({ currency: processFreightQuoteLines.currency, total: processFreightQuoteLines.total })
      .from(processFreightQuoteLines)
      .where(eq(processFreightQuoteLines.quoteId, quoteId));
    if (existing.agentId && existing.agentId !== agentId) {
      const [old] = await db.select({ name: freightAgents.name }).from(freightAgents).where(eq(freightAgents.id, existing.agentId));
      existingAgentName = old?.name ?? null;
    } else if (existing.agentId) {
      existingAgentName = agent.name;
    }
  }
  const actor = await quoteActorName();

  // Upload antes de gravar; se o banco falhar depois, o arquivo órfão é
  // removido para não acumular lixo no Storage.
  let uploaded: { fileName: string; storagePath: string } | null = null;
  if (file) {
    const path = `cotacoes/${processId}/${Date.now()}-${safeFileName(file.name)}`;
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
          .update(processFreightQuotes)
          .set({ ...values, ...filePatch, updatedAt: new Date() })
          .where(eq(processFreightQuotes.id, id));
        await tx.delete(processFreightQuoteLines).where(eq(processFreightQuoteLines.quoteId, id));
      } else {
        const [created] = await tx
          .insert(processFreightQuotes)
          .values({ processId, ...values, ...filePatch })
          .returning({ id: processFreightQuotes.id });
        id = created.id;
        await tx.insert(processEvents).values({
          processId,
          eventDate: new Date(),
          eventType: `Cotação de frete adicionada: ${agent.name}`,
        });
      }
      savedId = id;
      if (lines.length > 0) {
        await tx.insert(processFreightQuoteLines).values(lines.map((l) => ({ ...l, quoteId: id! })));
      }

      // Histórico da cotação: criação ou o que mudou, com o responsável.
      const descriptions = existing
        ? freightChangeDescriptions({
            before: existing,
            beforeAgentName: existingAgentName,
            beforeLines: existingLines,
            after: values,
            afterAgentName: agent.name,
            afterLines: lines,
            uploadedFileName: uploaded?.fileName ?? null,
            removedFile: removeFile && !uploaded && Boolean(existing.fileName),
          })
        : [
            `Cotação criada (${agent.name})${status !== "ATUALIZADO" ? ` · situação ${statusLabel(status)}` : ""}`,
            ...(totalsText(lines) ? [`Valores informados: ${totalsText(lines)}`] : []),
            ...(etdEstimated || etaEstimated
              ? [`Previsões: embarque ${fmtDate(etdEstimated)} · chegada ${fmtDate(etaEstimated)}`]
              : []),
            ...(drive.url ? ["Link do Drive adicionado"] : []),
            ...(uploaded ? [`Arquivo anexado: ${uploaded.fileName}`] : []),
          ];
      await recordQuoteEvents(tx, { processId, quoteType: "FREIGHT", quoteId: id, descriptions, actor });
    });
  } catch (e) {
    failed = true;
    console.error("saveFreightQuote falhou", e);
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

export async function deleteFreightQuote(quoteId: string, processId: string) {
  const back = `/processos/${processId}`;
  const actor = await quoteActorName();
  const [quote] = await db
    .select({ storagePath: processFreightQuotes.storagePath })
    .from(processFreightQuotes)
    .where(and(eq(processFreightQuotes.id, quoteId), eq(processFreightQuotes.processId, processId)));
  if (quote) {
    await db.transaction(async (tx) => {
      await tx.delete(processFreightQuotes).where(eq(processFreightQuotes.id, quoteId));
      // o histórico da cotação some junto; fica o registro no histórico do processo
      await tx
        .delete(processQuoteEvents)
        .where(and(eq(processQuoteEvents.quoteType, "FREIGHT"), eq(processQuoteEvents.quoteId, quoteId)));
      await tx.insert(processEvents).values({
        processId,
        eventDate: new Date(),
        eventType: "Cotação de frete removida",
        origin: `Cotação · ${actor}`,
      });
    });
    if (quote.storagePath) await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).remove([quote.storagePath]);
  }
  revalidatePath(back);
  redirect(withFlash(back, "Cotação removida."));
}

// Marca a cotação como a escolhida e leva o agente e o frete (+ despesas de
// origem) dela para o processo.
export async function selectFreightQuote(quoteId: string, processId: string) {
  const back = `/processos/${processId}`;

  const [quote] = await db
    .select()
    .from(processFreightQuotes)
    .where(and(eq(processFreightQuotes.id, quoteId), eq(processFreightQuotes.processId, processId)));
  if (!quote) redirect(withFlashError(back, "Cotação não encontrada."));

  const [process] = await db
    .select({ currency: processes.currency, incoterm: processes.incoterm })
    .from(processes)
    .where(eq(processes.id, processId));
  if (!process) redirect(withFlashError(back, "Processo não encontrado."));

  const lines = await db
    .select({ section: processFreightQuoteLines.section, currency: processFreightQuoteLines.currency, total: processFreightQuoteLines.total })
    .from(processFreightQuoteLines)
    .where(eq(processFreightQuoteLines.quoteId, quoteId))
    .orderBy(asc(processFreightQuoteLines.position));

  const [agent] = quote.agentId
    ? await db.select({ name: freightAgents.name }).from(freightAgents).where(eq(freightAgents.id, quote.agentId))
    : [];
  const agentName = agent?.name ?? "agente";

  const apply = freightToApply(lines, process.currency);
  const actor = await quoteActorName();

  await db.transaction(async (tx) => {
    // Só uma cotação fica "Fechada": a que foi escolhida. As outras que estavam
    // fechadas voltam para "Atualizado" (e isso entra no histórico delas).
    const reopened = await tx
      .select({ id: processFreightQuotes.id })
      .from(processFreightQuotes)
      .where(
        and(
          eq(processFreightQuotes.processId, processId),
          eq(processFreightQuotes.status, "FECHADO"),
          ne(processFreightQuotes.id, quoteId),
        ),
      );
    for (const r of reopened) {
      await recordQuoteEvents(tx, {
        processId,
        quoteType: "FREIGHT",
        quoteId: r.id,
        descriptions: [`Situação: ${statusLabel("FECHADO")} → ${statusLabel("ATUALIZADO")} (outra cotação foi escolhida)`],
        actor,
      });
    }
    await tx
      .update(processFreightQuotes)
      .set({ isSelected: false, status: "ATUALIZADO" })
      .where(and(eq(processFreightQuotes.processId, processId), eq(processFreightQuotes.status, "FECHADO")));
    await tx
      .update(processFreightQuotes)
      .set({ isSelected: false })
      .where(eq(processFreightQuotes.processId, processId));
    await tx
      .update(processFreightQuotes)
      .set({ isSelected: true, status: "FECHADO", updatedAt: new Date() })
      .where(eq(processFreightQuotes.id, quoteId));

    const patch: Partial<typeof processes.$inferInsert> = { updatedAt: new Date() };
    if (quote.agentId) patch.agentId = quote.agentId;
    if (!process.incoterm && quote.incoterm) patch.incoterm = quote.incoterm;
    if (apply.value !== null) {
      patch.internationalFreightValue = apply.value.toFixed(2);
      if (!process.currency) patch.currency = apply.currency as Currency;
    }
    await tx.update(processes).set(patch).where(eq(processes.id, processId));

    await recordQuoteEvents(tx, {
      processId,
      quoteType: "FREIGHT",
      quoteId,
      descriptions: [
        `Cotação escolhida · situação ${statusLabel(quote.status)} → ${statusLabel("FECHADO")}`,
        ...(apply.value !== null
          ? [`Frete Internacional do processo atualizado para ${formatMoney(apply.value, apply.currency)}`]
          : []),
      ],
      actor,
    });
    await tx.insert(processEvents).values({
      processId,
      eventDate: new Date(),
      eventType:
        apply.value !== null
          ? `Cotação de frete escolhida: ${agentName} · frete ${formatMoney(apply.value, apply.currency)}`
          : `Cotação de frete escolhida: ${agentName}`,
    });
  });

  revalidatePath(back);
  if (apply.value === null) {
    redirect(withFlash(back, `Cotação de ${agentName} escolhida. ${apply.reason}`));
  }
  redirect(
    withFlash(
      back,
      `Cotação de ${agentName} escolhida: Frete Internacional do processo agora é ${formatMoney(apply.value, apply.currency)}.`,
    ),
  );
}

// Tira a marca de "escolhida" (não mexe nos valores já levados ao processo).
export async function clearFreightQuoteSelection(processId: string) {
  const back = `/processos/${processId}`;
  const actor = await quoteActorName();
  await db.transaction(async (tx) => {
    const selected = await tx
      .select({ id: processFreightQuotes.id, status: processFreightQuotes.status })
      .from(processFreightQuotes)
      .where(and(eq(processFreightQuotes.processId, processId), eq(processFreightQuotes.isSelected, true)));
    await tx
      .update(processFreightQuotes)
      .set({ isSelected: false, status: "ATUALIZADO" })
      .where(and(eq(processFreightQuotes.processId, processId), eq(processFreightQuotes.isSelected, true)));
    for (const q of selected) {
      await recordQuoteEvents(tx, {
        processId,
        quoteType: "FREIGHT",
        quoteId: q.id,
        descriptions: [`Escolha removida · situação ${statusLabel(q.status)} → ${statusLabel("ATUALIZADO")}`],
        actor,
      });
    }
  });
  revalidatePath(back);
  redirect(withFlash(back, "Escolha da cotação removida. O frete do processo continua como estava."));
}

// Dólar (ou outra moeda) do dia, só para comparar as cotações na tela: não
// grava nada nem altera o câmbio do processo. Usa a PTAX de venda de hoje (ou
// do último dia útil publicado pelo Bacen).
export async function fetchDailyRate(
  currency: string,
): Promise<{ ok: true; rate: number; date: string } | { ok: false; error: string }> {
  if (!["USD", "EUR", "CNY", "GBP", "JPY"].includes(currency)) {
    return { ok: false, error: "Essa moeda não tem câmbio automático — digite o valor." };
  }
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const result = await fetchPtaxRate({ currency: currency as PtaxCurrency, date: today });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, rate: result.data.rate, date: result.data.date };
}
