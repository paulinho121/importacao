/* eslint-disable @typescript-eslint/no-explicit-any */
// Valida os índices propostos com volume projetado (alguns anos de uso), TUDO
// dentro de uma transação desfeita no fim: gera dados sintéticos, mede o tempo de
// execução no servidor (EXPLAIN ANALYZE) sem e com os índices e o custo extra de
// escrita. Nada fica gravado.
//
//   npx tsx scripts/test-indexes.mts

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config();
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1, fetch_types: false });

class Rollback extends Error {}

const INDEXES = [
  "create index zz_i1 on process_items (process_id)",
  "create index zz_i2 on process_items (purchase_order_id)",
  "create index zz_i3 on process_events (process_id, event_date desc)",
  "create index zz_i4 on process_invoices (process_id)",
  "create index zz_i5 on process_documents (process_id)",
  "create index zz_i6 on process_payables (process_id)",
  "create index zz_i7 on process_lpcos (process_id)",
  "create index zz_i8 on purchase_orders (process_id)",
  "create index zz_i9 on purchase_order_items (purchase_order_id)",
  "create index zz_i10 on purchase_order_documents (purchase_order_id)",
  "create index zz_i11 on item_reservations (item_id)",
  "create index zz_i12 on products (default_supplier_id)",
  "create index zz_i13 on product_lpcos (product_id)",
  "create index zz_i14 on product_price_tiers (product_id)",
];

async function main() {
  await sql.begin(async (tx) => {
    const [{ id: supplier }] = await tx`select id from suppliers limit 1`;
    const P = 600;

    // ---- volume sintético
    await tx`insert into processes (process_number, supplier_id) select 'ZZSYN-' || g, ${supplier} from generate_series(1, ${P}) g`;
    await tx`insert into purchase_orders (po_number, supplier_id, process_id) select 'ZZSYN-PO-' || row_number() over (), ${supplier}, p.id from processes p cross join generate_series(1, 2) where p.process_number like 'ZZSYN-%'`;
    await tx`insert into process_items (process_id, purchase_order_id, description, quantity)
             select p.id, (select id from purchase_orders o where o.process_id = p.id limit 1), 'item ' || g, 1
             from processes p cross join generate_series(1, 50) g where p.process_number like 'ZZSYN-%'`;
    await tx`insert into process_events (process_id, event_date, event_type) select p.id, now() - (g || ' hours')::interval, 'evento ' || g from processes p cross join generate_series(1, 80) g where p.process_number like 'ZZSYN-%'`;
    await tx`insert into process_invoices (process_id, invoice_number) select p.id, 'INV' || g from processes p cross join generate_series(1, 3) g where p.process_number like 'ZZSYN-%'`;
    await tx`insert into process_documents (process_id, doc_type) select p.id, 'OTHER' from processes p cross join generate_series(1, 3) g where p.process_number like 'ZZSYN-%'`;
    await tx`insert into purchase_order_items (purchase_order_id, description) select o.id, 'it ' || g from purchase_orders o cross join generate_series(1, 6) g where o.po_number like 'ZZSYN-PO-%'`;
    // dois processos sem pedidos, para medir a exclusão em cascata (na aplicação o pedido é desvinculado antes)
    await tx`insert into processes (process_number, supplier_id) values ('ZZSYN-D1', ${supplier}), ('ZZSYN-D2', ${supplier})`;
    await tx`insert into process_items (process_id, description, quantity) select p.id, 'd' || g, 1 from processes p cross join generate_series(1, 10) g where p.process_number in ('ZZSYN-D1', 'ZZSYN-D2')`;
    await tx`insert into process_events (process_id, event_date, event_type) select p.id, now(), 'd' || g from processes p cross join generate_series(1, 10) g where p.process_number in ('ZZSYN-D1', 'ZZSYN-D2')`;
    await tx`analyze processes`;
    await tx`analyze process_items`;
    await tx`analyze process_events`;
    await tx`analyze purchase_orders`;
    await tx`analyze purchase_order_items`;
    await tx`analyze process_invoices`;
    await tx`analyze process_documents`;

    const count = async (t: string) => (await tx.unsafe(`select count(*)::int n from ${t}`))[0].n;
    console.log(
      `Volume simulado: ${await count("processes")} processos | ${await count("process_items")} itens | ${await count("process_events")} eventos | ${await count("purchase_orders")} pedidos | ${await count("purchase_order_items")} itens de pedido\n`,
    );

    const [{ pid }] = await tx`select id as pid from processes where process_number = 'ZZSYN-377'`;
    const [{ oid }] = await tx`select id as oid from purchase_orders where process_id = ${pid} limit 1`;

    const queries: [string, string][] = [
      ["Itens de um processo (tela do processo)", `select * from process_items where process_id = '${pid}'`],
      ["Histórico de um processo, mais recente primeiro", `select * from process_events where process_id = '${pid}' order by event_date desc`],
      ["Invoices de um processo", `select * from process_invoices where process_id = '${pid}'`],
      ["Documentos de um processo", `select * from process_documents where process_id = '${pid}'`],
      ["Pedidos de um processo", `select * from purchase_orders where process_id = '${pid}'`],
      ["Itens de um pedido (tela do pedido)", `select * from purchase_order_items where purchase_order_id = '${oid}'`],
      ["Desvincular pedido (apaga itens que vieram dele)", `delete from process_items where process_id = '${pid}' and purchase_order_id = '${oid}'`],
    ];
    const timeOf = async (q: string) => {
      const samples: number[] = [];
      for (let i = 0; i < 5; i++) {
        const plan = (await tx.unsafe(`explain (analyze, format json) ${q}`))[0]["QUERY PLAN"][0];
        samples.push(plan["Execution Time"] as number);
      }
      samples.sort((a, b) => a - b);
      return samples[2];
    };

    const before: Record<string, number> = {};
    for (const [name, q] of queries) before[name] = await timeOf(q);
    // custo de apagar um processo inteiro (cascata em 7 tabelas filhas)
    const delBefore = (await tx.unsafe(`explain (analyze, format json) delete from processes where id = '${(await tx`select id from processes where process_number = 'ZZSYN-D1'`)[0].id}'`))[0]["QUERY PLAN"][0]["Execution Time"] as number;

    // custo de escrita SEM índices: inserir 20 mil itens
    const w0 = performance.now();
    await tx`insert into process_items (process_id, description, quantity) select p.id, 'w ' || g, 1 from processes p cross join generate_series(1, 40) g where p.process_number like 'ZZSYN-%' and p.process_number <= 'ZZSYN-9'`;
    const writeBefore = performance.now() - w0;
    await tx`delete from process_items where description like 'w %'`;

    for (const ddl of INDEXES) await tx.unsafe(ddl);
    await tx`analyze process_items`;
    await tx`analyze process_events`;
    await tx`analyze purchase_orders`;

    const after: Record<string, number> = {};
    for (const [name, q] of queries) after[name] = await timeOf(q);
    const delAfter = (await tx.unsafe(`explain (analyze, format json) delete from processes where id = '${(await tx`select id from processes where process_number = 'ZZSYN-D2'`)[0].id}'`))[0]["QUERY PLAN"][0]["Execution Time"] as number;

    const w1 = performance.now();
    await tx`insert into process_items (process_id, description, quantity) select p.id, 'w ' || g, 1 from processes p cross join generate_series(1, 40) g where p.process_number like 'ZZSYN-%' and p.process_number <= 'ZZSYN-9'`;
    const writeAfter = performance.now() - w1;

    console.table(
      [...queries.map(([name]) => ({ consulta: name, "sem índice (ms)": +before[name].toFixed(3), "com índice (ms)": +after[name].toFixed(3), ganho: `${(before[name] / after[name]).toFixed(1)}x` })),
        { consulta: "Apagar um processo inteiro (cascata)", "sem índice (ms)": +delBefore.toFixed(2), "com índice (ms)": +delAfter.toFixed(2), ganho: `${(delBefore / delAfter).toFixed(1)}x` }],
    );
    console.log(`Custo de escrita (insere ~${40 * 9} itens de uma vez, tempo total incl. rede): sem índices ${writeBefore.toFixed(0)} ms | com 14 índices ${writeAfter.toFixed(0)} ms`);
    throw new Rollback();
  });
}

main()
  .catch((e) => {
    if (!(e instanceof Rollback)) console.error(e);
    else console.log("\n(tudo desfeito: nenhum dado foi gravado)");
  })
  .finally(async () => {
    const [{ n }] = await sql`select count(*)::int n from processes where process_number like 'ZZSYN%'`;
    console.log("sobras no banco após o teste:", n);
    await sql.end();
    process.exit();
  });
