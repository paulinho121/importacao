/* eslint-disable @typescript-eslint/no-explicit-any */
// Prova de paridade dos drivers: roda as MESMAS consultas do Drizzle com o driver
// antigo (postgres.js) e o atual (pg) sobre os dados reais, e compara o resultado
// campo a campo (datas, números, booleanos, enums, contagens, nulos).
//
//   npx tsx scripts/test-driver-parity.mts

import { config } from "dotenv";
import postgres from "postgres";
import { Pool } from "pg";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { eq, sql, desc } from "drizzle-orm";
import * as S from "@/db/schema";

config({ path: ".env.local" });
config();

const url = process.env.DATABASE_URL!;
const client = postgres(url, { prepare: false, max: 2, fetch_types: false });
const pool = new Pool({ connectionString: url, max: 2 });
pool.on("error", () => {});
const a = drizzlePg(client, { schema: S });
const b = drizzleNode(pool, { schema: S });

const norm = (v: unknown) => JSON.stringify(v, (_k, x) => (x instanceof Date ? `Date:${x.toISOString()}` : typeof x === "bigint" ? `big:${x}` : x));

const cases: [string, (db: any) => Promise<unknown>][] = [
  ["products (tudo, 1.069 linhas: timestamps, numeric, boolean, enum, nulos)", (db) => db.select().from(S.products).orderBy(S.products.sku)],
  ["products + fornecedor (join)", (db) => db.select({ sku: S.products.sku, s: S.suppliers.name, c: S.products.costPrice }).from(S.products).leftJoin(S.suppliers, eq(S.products.defaultSupplierId, S.suppliers.id)).orderBy(S.products.sku)],
  ["product_photos", (db) => db.select().from(S.productPhotos).orderBy(S.productPhotos.url)],
  ["product_lpcos (datas)", (db) => db.select().from(S.productLpcos).orderBy(S.productLpcos.lpcoNumber, S.productLpcos.branch, S.productLpcos.id)],
  ["suppliers", (db) => db.select().from(S.suppliers).orderBy(S.suppliers.name)],
  ["freight_agents", (db) => db.select().from(S.freightAgents).orderBy(S.freightAgents.name)],
  ["company_branches", (db) => db.select().from(S.companyBranches).orderBy(S.companyBranches.name)],
  ["purchase_orders", (db) => db.select().from(S.purchaseOrders).orderBy(S.purchaseOrders.poNumber)],
  ["purchase_order_items", (db) => db.select().from(S.purchaseOrderItems).orderBy(S.purchaseOrderItems.id)],
  ["purchase_order_events", (db) => db.select().from(S.purchaseOrderEvents).orderBy(desc(S.purchaseOrderEvents.createdAt), S.purchaseOrderEvents.id)],
  ["profiles", (db) => db.select().from(S.profiles)],
  ["external_import_items", (db) => db.select().from(S.externalImportItems).orderBy(S.externalImportItems.id)],
  ["agregados: count(*) com mapWith e sum numeric", (db) => db.select({ n: sql<number>`count(*)`.mapWith(Number), total: sql<string>`coalesce(sum(${S.products.costPrice}), 0)` }).from(S.products)],
  ["agregados: group by supplier", (db) => db.select({ s: S.products.defaultSupplierId, n: sql<number>`count(*)`.mapWith(Number) }).from(S.products).groupBy(S.products.defaultSupplierId).orderBy(sql`2 desc`, S.products.defaultSupplierId)],
];

let allOk = true;
for (const [name, q] of cases) {
  const [ra, rb] = await Promise.all([q(a), q(b)]);
  const same = norm(ra) === norm(rb);
  allOk &&= same;
  console.log(`${same ? "✔" : "✘"} ${name} — ${(ra as any[]).length} linha(s)`);
  if (!same) {
    const x = ra as any[], y = rb as any[];
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      if (norm(x[i]) !== norm(y[i])) { console.log("   diferença na linha", i, "\n   postgres.js:", norm(x[i]).slice(0, 300), "\n   pg         :", norm(y[i]).slice(0, 300)); break; }
    }
  }
}
await client.end();
await pool.end();
console.log(allOk ? "\nPARIDADE TOTAL ✔ (mesmos dados, mesmos tipos)" : "\nDIVERGÊNCIA ✘");
process.exit(allOk ? 0 : 1);
