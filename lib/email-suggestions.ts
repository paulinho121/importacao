// Sugestão do processo de um e-mail: procura no assunto e no corpo a "Referência
// do agente" (processes.external_reference, ex.: IA0868-26) e os números de proposta
// das cotações (ex.: RKT-014722-26). É só uma sugestão: quem confirma é a pessoa.
import { isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { processes, processFreightQuotes, processSupplierQuotes } from "@/db/schema";

const MIN_KEY_LENGTH = 4;
const SUBJECT_WEIGHT = 3;
const BODY_WEIGHT = 1;

export type ProcessRef = { id: string; processNumber: string; externalReference: string | null };
export type ProposalRef = { processId: string; proposal: string | null };

type IndexEntry = { key: string; pattern: RegExp; processId: string };

export type SuggestionIndex = {
  entries: IndexEntry[];
  processNumberById: Map<string, string>;
};

export type EmailSuggestion = {
  processId: string;
  processNumber: string;
  matchedKeys: string[];
  // Quantos outros processos também bateram (para avisar que a sugestão pode não ser única).
  otherCandidates: number;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toUpperCase().replace(/\s+/g, " ");
  return key.length >= MIN_KEY_LENGTH ? key : null;
}

// Fronteira: o código não pode estar colado em outro código alfanumérico
// (IA0868-26 não pode casar dentro de IA0868-265).
function keyPattern(key: string): RegExp {
  return new RegExp(`(?<![A-Z0-9])${escapeRegExp(key)}(?![A-Z0-9])`);
}

export function buildSuggestionIndex(processRows: ProcessRef[], proposalRows: ProposalRef[]): SuggestionIndex {
  const entries: IndexEntry[] = [];
  const seen = new Set<string>();
  const add = (processId: string, raw: string | null | undefined) => {
    const key = normalizeKey(raw);
    if (!key) return;
    const dedupe = `${processId}|${key}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    entries.push({ key, pattern: keyPattern(key), processId });
  };

  const processNumberById = new Map<string, string>();
  for (const p of processRows) {
    processNumberById.set(p.id, p.processNumber);
    add(p.id, p.externalReference);
  }
  for (const q of proposalRows) add(q.processId, q.proposal);

  return { entries, processNumberById };
}

// Melhor processo para o e-mail, ou null. Acertos no assunto valem mais que no corpo.
export function suggestProcess(
  index: SuggestionIndex,
  email: { subject: string | null; bodyText: string },
): EmailSuggestion | null {
  const subject = (email.subject ?? "").toUpperCase();
  const body = email.bodyText.toUpperCase();

  const score = new Map<string, number>();
  const keys = new Map<string, Set<string>>();
  for (const entry of index.entries) {
    const inSubject = entry.pattern.test(subject);
    const inBody = inSubject ? false : entry.pattern.test(body);
    if (!inSubject && !inBody) continue;
    score.set(entry.processId, (score.get(entry.processId) ?? 0) + (inSubject ? SUBJECT_WEIGHT : BODY_WEIGHT));
    const set = keys.get(entry.processId) ?? new Set<string>();
    set.add(entry.key);
    keys.set(entry.processId, set);
  }
  if (score.size === 0) return null;

  let bestId: string | null = null;
  let bestScore = -1;
  for (const [processId, value] of score) {
    if (value > bestScore) {
      bestId = processId;
      bestScore = value;
    }
  }
  if (!bestId) return null;

  const processNumber = index.processNumberById.get(bestId);
  if (!processNumber) return null;
  return {
    processId: bestId,
    processNumber,
    matchedKeys: [...(keys.get(bestId) ?? [])],
    otherCandidates: score.size - 1,
  };
}

export async function loadSuggestionIndex(): Promise<SuggestionIndex> {
  const [processRows, freight, supplier] = await Promise.all([
    db
      .select({
        id: processes.id,
        processNumber: processes.processNumber,
        externalReference: processes.externalReference,
      })
      .from(processes),
    db
      .select({ processId: processFreightQuotes.processId, proposal: processFreightQuotes.proposal })
      .from(processFreightQuotes)
      .where(isNotNull(processFreightQuotes.proposal)),
    db
      .select({ processId: processSupplierQuotes.processId, proposal: processSupplierQuotes.proposal })
      .from(processSupplierQuotes)
      .where(isNotNull(processSupplierQuotes.proposal)),
  ]);
  return buildSuggestionIndex(processRows, [...freight, ...supplier]);
}
