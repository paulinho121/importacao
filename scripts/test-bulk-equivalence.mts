/* eslint-disable @typescript-eslint/no-explicit-any */
// Prova de equivalência: roda o algoritmo ANTIGO (uma instrução por registro) e o
// NOVO (em lote, lib/product-imports.ts) sobre os mesmos dados reais, cada um
// dentro de uma transação que é DESFEITA no fim (nada fica gravado), e compara o
// resultado final tabela a tabela, além de contar instruções e tempo.
//
//   npx tsx scripts/test-bulk-equivalence.mts

import { config } from "dotenv";
import { and, eq, isNull, or } from "drizzle-orm";

process.env.DB_QUERY_LOG = "1";
config({ path: ".env.local" });
config();

const g = globalThis as any;
const { db } = await import("@/db/client");
const { products, productLpcos } = await import("@/db/schema");
const { applyCpListToProducts, applyLpcoRecords } = await import("@/lib/product-imports");
const { sql } = await import("drizzle-orm");

class Rollback extends Error {}
async function inRollback<T>(fn: (tx: any) => Promise<T>): Promise<{ value: T; ms: number; stmts: number }> {
  let out: any;
  g.__dbQueries = [];
  const t0 = performance.now();
  try {
    await db.transaction(async (tx: any) => {
      const value = await fn(tx);
      const ms = Math.round(performance.now() - t0);
      const stmts = g.__dbQueries.length;
      out = { value, ms, stmts };
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  return out;
}

// ------------------------------------------------------------------ 1) lista de CP
type Match = { productId: string; result: "FOUND" | "FOUND_NATIONAL" | "FOUND_APPROX"; ref: string; ncm: string | null };

async function oldCp(tx: any, source: string, now: Date, matches: Match[]) {
  await tx.update(products).set({ cpListResult: "NOT_FOUND", cpListRef: null, cpListNcm: null, cpListCheckedAt: now, cpListSource: source });
  for (const m of matches) {
    await tx
      .update(products)
      .set({
        cpListResult: m.result,
        cpListRef: m.ref || null,
        cpListNcm: m.ncm,
        ...(m.result === "FOUND" ? { hasPublicConsultation: true, cpStatus: "POSSUI" } : {}),
      })
      .where(eq(products.id, m.productId));
    if (m.result === "FOUND" && m.ref) {
      await tx
        .update(products)
        .set({ publicConsultationRef: `Consulta Pública nº ${m.ref.split(", ")[0]}` })
        .where(and(eq(products.id, m.productId), or(isNull(products.publicConsultationRef), eq(products.publicConsultationRef, ""))));
    }
  }
}

const snapCp = async (tx: any) =>
  JSON.stringify(
    (await tx.execute(sql`select id, cp_list_result, cp_list_ref, cp_list_ncm, cp_list_source, has_public_consultation, cp_status, public_consultation_ref from products order by id`)).rows,
  );

async function testCp() {
  const ids: string[] = (await db.select({ id: products.id }).from(products).orderBy(products.sku).limit(120)).map((r: any) => r.id);
  const m: Match[] = ids.map((id, i) => ({
    productId: id,
    result: (["FOUND", "FOUND_NATIONAL", "FOUND_APPROX"] as const)[i % 3],
    ref: i % 5 === 0 ? "" : `${10 + (i % 40)}/26${i % 4 === 0 ? ", 99/25" : ""}`,
    ncm: i % 2 ? "9405.99.00" : null,
  }));
  // casos de borda: o MESMO produto 3 vezes (FOUND com ref -> FOUND_NATIONAL -> FOUND com outra ref)
  m.push({ productId: ids[0], result: "FOUND_NATIONAL", ref: "1/1", ncm: null });
  m.push({ productId: ids[0], result: "FOUND", ref: "77/26, 5/5", ncm: "1111.11.11" });
  m.push({ productId: ids[1], result: "FOUND", ref: "55/26", ncm: null });
  m.push({ productId: ids[1], result: "FOUND_APPROX", ref: "", ncm: null });
  const now = new Date("2026-11-06T12:00:00Z");
  const source = "lista-teste (atualizada em 2026-11-06)";

  const a = await inRollback(async (tx) => (await oldCp(tx, source, now, m), snapCp(tx)));
  const b = await inRollback(async (tx) => (await applyCpListToProducts(tx, { source, now, matches: m }), snapCp(tx)));
  console.log(`\n[Lista de CP] ${m.length} registros`);
  console.log(`  antigo : ${a.stmts} instruções, ${a.ms} ms`);
  console.log(`  em lote: ${b.stmts} instruções, ${b.ms} ms`);
  console.log(`  resultado final IDÊNTICO em todas as ${ids.length}+ linhas de products: ${a.value === b.value ? "SIM ✔" : "NÃO ✘"}`);
  return a.value === b.value;
}

// ------------------------------------------------------------------ 2) planilha de LPCO
type Rec = { productId: string; branch: string; status: string; lpcoNumber: string | null; requestedAt: string | null; approvedAt: string | null; validUntil: string | null; notes: string | null };

async function oldLpco(tx: any, records: Rec[]) {
  let inserted = 0;
  let updated = 0;
  for (const r of records) {
    const values = { branch: r.branch, status: r.status, requestedAt: r.requestedAt, approvedAt: r.approvedAt, validUntil: r.validUntil, lpcoNumber: r.lpcoNumber, notes: r.notes };
    const [existing] = r.lpcoNumber
      ? await tx.select({ id: productLpcos.id }).from(productLpcos).where(and(eq(productLpcos.productId, r.productId), eq(productLpcos.lpcoNumber, r.lpcoNumber)))
      : [];
    if (existing) {
      await tx.update(productLpcos).set({ ...values, updatedAt: new Date() }).where(eq(productLpcos.id, existing.id));
      updated++;
    } else {
      await tx.insert(productLpcos).values({ productId: r.productId, ...values });
      inserted++;
    }
  }
  return { inserted, updated };
}

const snapLpco = async (tx: any) =>
  JSON.stringify(
    (await tx.execute(sql`select product_id, branch, status, requested_at, approved_at, valid_until, lpco_number, notes from product_lpcos order by product_id, lpco_number nulls first, branch, status, notes`)).rows,
  );

async function testLpco() {
  const some: any[] = await db.select().from(productLpcos).limit(10);
  const pids: string[] = (await db.select({ id: products.id }).from(products).orderBy(products.sku).limit(40)).map((r: any) => r.id);
  const recs: Rec[] = [];
  // atualizações de LPCOs que já existem (mesmo nº)
  for (const e of some.filter((x) => x.lpcoNumber)) {
    recs.push({ productId: e.productId, branch: e.branch, status: "DEFERIDO", lpcoNumber: e.lpcoNumber, requestedAt: "2026-01-02", approvedAt: "2026-01-09", validUntil: "2026-07-08", notes: "atualizado pelo teste" });
  }
  // novos (com nº) e sem nº
  pids.forEach((id, i) => {
    recs.push({ productId: id, branch: ["SP", "SC", "CE"][i % 3], status: ["EM_ANALISE", "DEFERIDO", "NAO_SOLICITADO"][i % 3], lpcoNumber: i % 4 === 0 ? null : `IZZTEST${i}`, requestedAt: "2026-02-01", approvedAt: i % 3 === 1 ? "2026-02-10" : null, validUntil: null, notes: i % 2 ? "obs" : null });
  });
  // borda: o MESMO nº duas vezes na planilha (a 2ª atualiza a 1ª)
  recs.push({ productId: pids[2], branch: "SP", status: "DEFERIDO", lpcoNumber: "IZZDUP", requestedAt: "2026-03-01", approvedAt: null, validUntil: null, notes: "primeira" });
  recs.push({ productId: pids[2], branch: "SC", status: "INDEFERIDO", lpcoNumber: "IZZDUP", requestedAt: "2026-03-05", approvedAt: "2026-03-06", validUntil: "2026-09-01", notes: "segunda" });

  const a = await inRollback(async (tx) => {
    const r = await oldLpco(tx, recs);
    return { r, snap: await snapLpco(tx) };
  });
  const b = await inRollback(async (tx) => {
    const r = await applyLpcoRecords(tx, recs);
    return { r, snap: await snapLpco(tx) };
  });
  console.log(`\n[Planilha de LPCO] ${recs.length} linhas`);
  console.log(`  antigo : ${a.stmts} instruções, ${a.ms} ms | inseridas ${a.value.r.inserted}, atualizadas ${a.value.r.updated}`);
  console.log(`  em lote: ${b.stmts} instruções, ${b.ms} ms | inseridas ${b.value.r.inserted}, atualizadas ${b.value.r.updated}`);
  const same = a.value.snap === b.value.snap && a.value.r.inserted === b.value.r.inserted && a.value.r.updated === b.value.r.updated;
  console.log(`  contagens e tabela product_lpcos IDÊNTICAS: ${same ? "SIM ✔" : "NÃO ✘"}`);
  return same;
}

const results = [await testCp(), await testLpco()];
console.log(results.every(Boolean) ? "\nTUDO EQUIVALENTE ✔ (nada foi gravado: todas as transações foram desfeitas)" : "\nDIVERGÊNCIA ✘");
process.exit(results.every(Boolean) ? 0 : 1);
