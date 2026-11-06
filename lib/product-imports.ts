import { and, inArray, sql } from "drizzle-orm";
import type { db } from "@/db/client";
import { productLpcos, products } from "@/db/schema";

// Gravações em lote das importações de produtos (lista pública de CP e planilha
// de LPCOs). Antes cada registro era uma instrução à parte, esperando a
// anterior: com ~65 ms por ida e volta (2 por instrução com parâmetros), 300
// registros levavam ~40 s. Aqui viram poucas instruções (UPDATE ... FROM
// (VALUES ...) e INSERT de várias linhas), com o MESMO resultado final.
//
// Este arquivo NÃO é "use server": as funções recebem uma transação e não podem
// ser chamadas de fora do servidor.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const CHUNK = 400; // linhas por instrução (<= 5 parâmetros por linha: bem abaixo do limite de 65 mil)

function chunks<T>(list: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------- lista de CP

export type CpMatch = { productId: string; result: "FOUND" | "FOUND_NATIONAL" | "FOUND_APPROX"; ref: string; ncm: string | null };

// Todo produto é marcado como conferido (NOT_FOUND por padrão) e os que aparecem
// na lista recebem o resultado, a(s) CP(s) e o NCM da lista. Quem consta como
// deferido (FOUND) passa a ter "Status da CP = Já possui" e, se estava vazia, a
// Ref. Consulta Pública. Mesmas regras da versão item a item, inclusive com o
// mesmo produto repetido na lista: o resultado é o do último; "Já possui" vale se
// QUALQUER ocorrência for FOUND; e a referência é a da primeira ocorrência FOUND.
export async function applyCpListToProducts(
  tx: Tx,
  { source, now, matches }: { source: string; now: Date; matches: CpMatch[] },
) {
  await tx
    .update(products)
    .set({ cpListResult: "NOT_FOUND", cpListRef: null, cpListNcm: null, cpListCheckedAt: now, cpListSource: source });

  const last = new Map<string, CpMatch>();
  const anyFound = new Set<string>();
  const firstRef = new Map<string, string>();
  for (const m of matches) {
    last.set(m.productId, m);
    if (m.result === "FOUND") {
      anyFound.add(m.productId);
      if (m.ref && !firstRef.has(m.productId)) firstRef.set(m.productId, `Consulta Pública nº ${m.ref.split(", ")[0]}`);
    }
  }

  for (const part of chunks([...last.values()])) {
    const values = sql.join(
      part.map(
        (m) =>
          sql`(${m.productId}::uuid, ${m.result}::text, ${m.ref || null}::text, ${m.ncm}::text, ${anyFound.has(m.productId)}::boolean)`,
      ),
      sql`, `,
    );
    await tx.execute(sql`
      update products p set
        cp_list_result = v.result,
        cp_list_ref = v.ref,
        cp_list_ncm = v.ncm,
        has_public_consultation = case when v.found then true else p.has_public_consultation end,
        cp_status = case when v.found then 'POSSUI' else p.cp_status end
      from (values ${values}) as v(id, result, ref, ncm, found)
      where p.id = v.id`);
  }

  for (const part of chunks([...firstRef.entries()])) {
    const values = sql.join(part.map(([id, ref]) => sql`(${id}::uuid, ${ref}::text)`), sql`, `);
    await tx.execute(sql`
      update products p set public_consultation_ref = v.ref
      from (values ${values}) as v(id, ref)
      where p.id = v.id and (p.public_consultation_ref is null or p.public_consultation_ref = '')`);
  }
}

// ------------------------------------------------------------ planilha de LPCOs

export type LpcoRecord = {
  productId: string;
  branch: string;
  status: string;
  lpcoNumber: string | null;
  requestedAt: string | null;
  approvedAt: string | null;
  validUntil: string | null;
  notes: string | null;
};

// Cada linha vira (ou atualiza) uma solicitação do produto no estado. O Nº do
// LPCO identifica a solicitação: repetir a mesma planilha atualiza em vez de
// duplicar. Uma única consulta para achar as existentes, um INSERT em lote e um
// UPDATE em lote — em vez de uma consulta + uma gravação por linha.
export async function applyLpcoRecords(tx: Tx, records: LpcoRecord[]) {
  if (records.length === 0) return { inserted: 0, updated: 0 };

  const productIds = [...new Set(records.map((r) => r.productId))];
  const existing: { id: string; productId: string; lpcoNumber: string | null }[] = [];
  for (const part of chunks(productIds, 1000)) {
    existing.push(
      ...(await tx
        .select({ id: productLpcos.id, productId: productLpcos.productId, lpcoNumber: productLpcos.lpcoNumber })
        .from(productLpcos)
        .where(and(inArray(productLpcos.productId, part)))),
    );
  }
  const idByKey = new Map<string, string>();
  for (const e of existing) if (e.lpcoNumber) idByKey.set(`${e.productId}|${e.lpcoNumber}`, e.id);

  const inserts: (typeof productLpcos.$inferInsert)[] = [];
  const updates = new Map<string, LpcoRecord>(); // id -> valores (a última ocorrência vence)
  let inserted = 0;
  let updated = 0;
  for (const r of records) {
    const key = r.lpcoNumber ? `${r.productId}|${r.lpcoNumber}` : null;
    const knownId = key ? idByKey.get(key) : undefined;
    if (knownId) {
      updates.set(knownId, r);
      updated++;
    } else {
      const id = crypto.randomUUID();
      if (key) idByKey.set(key, id); // repetida na mesma planilha: a próxima ocorrência atualiza esta
      inserts.push({
        id,
        productId: r.productId,
        branch: r.branch,
        status: r.status,
        requestedAt: r.requestedAt,
        approvedAt: r.approvedAt,
        validUntil: r.validUntil,
        lpcoNumber: r.lpcoNumber,
        notes: r.notes,
      });
      inserted++;
    }
  }

  for (const part of chunks(inserts)) await tx.insert(productLpcos).values(part);

  const now = new Date();
  for (const part of chunks([...updates.entries()])) {
    const values = sql.join(
      part.map(
        ([id, r]) =>
          sql`(${id}::uuid, ${r.branch}::text, ${r.status}::text, ${r.requestedAt}::date, ${r.approvedAt}::date, ${r.validUntil}::date, ${r.lpcoNumber}::text, ${r.notes}::text)`,
      ),
      sql`, `,
    );
    await tx.execute(sql`
      update product_lpcos l set
        branch = v.branch, status = v.status, requested_at = v.requested_at, approved_at = v.approved_at,
        valid_until = v.valid_until, lpco_number = v.lpco_number, notes = v.notes, updated_at = ${now.toISOString()}::timestamptz
      from (values ${values}) as v(id, branch, status, requested_at, approved_at, valid_until, lpco_number, notes)
      where l.id = v.id`);
  }

  return { inserted, updated };
}
