/* eslint-disable @typescript-eslint/no-explicit-any */
// Teste de desempenho dos salvamentos: executa as Server Actions reais contra o
// banco (com o Next.js/login substituídos por stubs em scripts/bench/), contando
// as instruções enviadas ao banco (inclusive BEGIN/COMMIT), as chamadas de login
// e o tempo. Tudo que é criado tem o prefixo ZZBENCH e é apagado no fim.
//
//   npx tsx scripts/bench-saves.mts [rótulo]      ex.: antes | depois
//
// O resultado vai para C:/tmp/bench-<rótulo>.json para comparação.

import { config } from "dotenv";
import * as nodeModule from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import postgres from "postgres";

process.env.DB_QUERY_LOG = "1";
config({ path: ".env.local" });
config();
// Troca, só neste teste, os módulos que exigem uma requisição do Next (cache e
// login) por stubs. registerHooks roda dentro da mesma thread, depois do tsx.
const stubDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "bench");
const stubUrl = (name: string) => pathToFileURL(path.join(stubDir, `stub-${name}.mjs`)).href;
(nodeModule as any).registerHooks({
  resolve(specifier: string, context: any, nextResolve: any) {
    if (specifier === "next/cache") return { url: stubUrl("cache"), shortCircuit: true };
    if (specifier === "@/lib/supabase-server" || /(^|\/)lib\/supabase-server(\.ts)?$/.test(specifier)) {
      return { url: stubUrl("supabase-server"), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const LABEL = process.argv[2] || "medicao";
const g = globalThis as any;
g.__bench = { authCalls: 0, user: null };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fd = (obj: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
};

type Row = { cenario: string; ms: number; instrucoes: number; begin_commit: number; logins: number; redirect?: string };
const rows: Row[] = [];

async function measure(label: string, fn: () => Promise<any>, runs = 1) {
  const samples: Row[] = [];
  for (let i = 0; i < runs; i++) {
    g.__dbQueries = [];
    g.__bench.authCalls = 0;
    const t0 = performance.now();
    let redirect: string | undefined;
    try {
      await fn();
    } catch (e: any) {
      if (typeof e?.digest === "string" && e.digest.startsWith("NEXT_REDIRECT")) {
        redirect = e.digest.split(";")[2]?.split("?")[0];
      } else throw e;
    }
    const ms = Math.round(performance.now() - t0);
    const qs: string[] = g.__dbQueries;
    samples.push({
      cenario: label,
      ms,
      instrucoes: qs.length,
      begin_commit: qs.filter((q) => /^\s*(begin|commit|rollback)/i.test(q)).length,
      logins: g.__bench.authCalls,
      redirect,
    });
  }
  samples.sort((a, b) => a.ms - b.ms);
  rows.push(samples[Math.floor(samples.length / 2)]); // mediana
}

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const cleanup = async () => {
  await sql`delete from purchase_orders where po_number like 'ZZBENCH%'`;
  await sql`delete from processes where process_number like 'ZZBENCH%'`;
  await sql`delete from products where sku like 'ZZBENCH%'`;
};

async function main() {
  await cleanup();
  const [supplier] = await sql`select id from suppliers where name = 'SWIT'`;
  const [product] = await sql`select id from products where sku = 'FM-U245HDR'`;
  const [agent] = await sql`select id from freight_agents order by name limit 1`;
  const [profile] = await sql`select id, email, name, role from profiles limit 1`;
  g.__bench.user = { id: profile.id, email: profile.email, name: profile.name, role: profile.role };

  const po: any = await import("@/app/pedidos-compra/actions");
  const pr: any = await import("@/app/processos/actions");
  const fq: any = await import("@/app/processos/freight-quotes-actions");
  const pd: any = await import("@/app/produtos/actions");
  const { db }: any = await import("@/db/client");
  const { sql: dsql }: any = await import("drizzle-orm");
  await db.execute(dsql`select 1`); // conexão aquecida (o 1º uso paga o handshake)
  await sleep(100);

  const idOf = async (n: string) => (await sql`select id from purchase_orders where po_number = ${n}`)[0]?.id as string;
  let n = 0;
  const num = (p: string) => `ZZBENCH-${p}-${Date.now() % 1e6}-${++n}`;

  // ---- pedido
  const numbers: string[] = [];
  await measure("Pedido: criar", async () => {
    const x = num("PO");
    numbers.push(x);
    await po.createPurchaseOrder(fd({ poNumber: x, supplierId: supplier.id, currency: "USD", incoterm: "EXW - Ex Works" }));
  }, 3);
  const poNumber = numbers[numbers.length - 1];
  const poId = await idOf(poNumber);
  await measure("Pedido: criar com número repetido", () => po.createPurchaseOrder(fd({ poNumber: numbers[0], supplierId: supplier.id })));
  await measure("Pedido: adicionar item do catálogo", () => po.addPurchaseOrderItem(poId, fd({ productId: product.id, quantity: "10", unitPrice: "5.5" })), 3);
  await measure("Pedido: adicionar item avulso", () => po.addPurchaseOrderItem(poId, fd({ description: "Item teste", sku: "ZZ1", quantity: "1", unitPrice: "2" })), 3);
  const [item] = await sql`select id from purchase_order_items where purchase_order_id = ${poId} limit 1`;
  await measure("Pedido: editar item", () => po.updatePurchaseOrderItem(item.id, poId, fd({ quantity: "20", unitPrice: "6" })), 3);
  await measure("Pedido: editar dados", () => po.updatePurchaseOrder(poId, fd({ poNumber, notes: `obs ${Date.now()}` })), 3);
  await measure("Pedido: marcar como Enviado", () => po.updatePurchaseOrderStatus(poId, fd({ status: "ENVIADO" })));
  await measure("Pedido: marcar como Confirmado", () => po.updatePurchaseOrderStatus(poId, fd({ status: "CONFIRMADO" })));

  // ---- processo
  const x2 = num("PO2");
  await po.createPurchaseOrder(fd({ poNumber: x2, supplierId: supplier.id })).catch(() => {});
  const po2 = await idOf(x2);
  await po.addPurchaseOrderItem(po2, fd({ productId: product.id, quantity: "5", unitPrice: "1" })).catch(() => {});
  const procNum = num("PR");
  await measure("Processo: criar com 1 pedido", () => pr.createProcess(fd({ processNumber: procNum, purchaseOrderId: po2, agentId: agent.id })));
  const [proc] = await sql`select id from processes where process_number = ${procNum}`;

  const x3 = num("PO3");
  await po.createPurchaseOrder(fd({ poNumber: x3, supplierId: supplier.id })).catch(() => {});
  const po3 = await idOf(x3);
  await po.addPurchaseOrderItem(po3, fd({ productId: product.id, quantity: "5", unitPrice: "1" })).catch(() => {});
  await measure("Pedido: colocar em processo existente", () => po.addToExistingProcess(po3, fd({ processId: proc.id })));
  await measure("Pedido: converter em processo", () => po.convertToProcess(poId, fd({ processNumber: num("CV") })));

  await measure("Processo: alterar status", () => pr.updateProcessStatus(proc.id, fd({ status: "EM_TRANSITO" })));
  await measure("Cotação de frete: salvar (3 linhas)", () =>
    fq.saveFreightQuote(
      proc.id,
      null,
      fd({
        agentId: agent.id,
        proposal: "ZZ",
        lineSection: ["FRETE", "ORIGEM", "DESTINO"],
        lineDescription: ["Frete", "TX origem", "TX destino"],
        lineQuantity: ["100", "", ""],
        lineUnitPrice: ["7", "", ""],
        lineUnit: ["KG", "", ""],
        lineMinimum: ["", "", ""],
        lineCurrency: ["USD", "USD", "USD"],
        lineTotal: ["700", "50", "30"],
      }),
    ),
  );

  // ---- produto (4 fotos por link: exercita a reordenação)
  const [tp] = await sql`insert into products (sku, description) values (${`ZZBENCH-${Date.now() % 1e6}`}, 'Produto teste') returning id, sku`;
  const links = ["a", "b", "c", "d"].map((x) => `https://example.com/zz-${tp.sku}-${x}.jpg`).join("\n");
  await measure("Produto: salvar com 4 fotos novas (links)", () =>
    pd.updateProduct(tp.id, fd({ sku: tp.sku, description: "Produto teste", photoLinks: links })),
  );
  await measure("Produto: salvar de novo (reordena 4 fotos)", () => pd.updateProduct(tp.id, fd({ sku: tp.sku, description: "Produto teste" })), 3);

  // troca da foto principal: confere o resultado (ordem e products.photo_url), não só a contagem
  const photos = await sql`select id, url from product_photos where product_id = ${tp.id} order by position, created_at`;
  const cover = photos[2];
  await measure("Produto: trocar a foto principal", () =>
    pd.updateProduct(tp.id, fd({ sku: tp.sku, description: "Produto teste", coverPhotoId: cover.id })),
  );
  const afterPhotos = await sql`select id, position from product_photos where product_id = ${tp.id} order by position`;
  const [afterProd] = await sql`select photo_url from products where id = ${tp.id}`;
  console.log("troca de capa correta:", afterPhotos[0].id === cover.id && afterProd.photo_url === cover.url, "| posições:", afterPhotos.map((x: any) => x.position).join(","));

  // ---- concorrência: 8 pedidos com o MESMO número ao mesmo tempo
  const same = num("RACE");
  const t0 = performance.now();
  const res = await Promise.allSettled(
    Array.from({ length: 8 }, () => po.createPurchaseOrder(fd({ poNumber: same, supplierId: supplier.id }))),
  );
  const outcomes: Record<string, number> = {};
  for (const r of res as any[]) {
    const k =
      r.status === "fulfilled"
        ? "ok"
        : typeof r.reason?.digest === "string"
          ? `redireciona (${decodeURIComponent(r.reason.digest.split(";")[2] ?? "").split("flashError=")[1]?.slice(0, 22) ?? "ok"}…)`
          : `ERRO: ${String(r.reason?.message).slice(0, 50)}`;
    outcomes[k] = (outcomes[k] ?? 0) + 1;
  }
  const created = (await sql`select count(*)::int n from purchase_orders where po_number = ${same}`)[0].n;
  const raceMs = Math.round(performance.now() - t0);

  // ---- vários usuários ao mesmo tempo: 10 pedidos diferentes em paralelo
  const t1 = performance.now();
  g.__dbQueries = [];
  await Promise.allSettled(Array.from({ length: 10 }, () => po.createPurchaseOrder(fd({ poNumber: num("PAR"), supplierId: supplier.id }))));
  const parMs = Math.round(performance.now() - t1);
  const parQ = g.__dbQueries.length;

  await cleanup();

  console.table(
    rows.map(({ cenario, ms, instrucoes, begin_commit, logins, redirect }) => ({
      cenario,
      ms,
      instrucoes,
      "begin/commit": begin_commit,
      logins,
      "redireciona p/": redirect ?? "",
    })),
  );
  console.log("concorrência (8 pedidos com o MESMO número):", { criados_no_banco: created, desfechos: outcomes, ms: raceMs });
  console.log("10 pedidos diferentes em paralelo:", { ms: parMs, instrucoes: parQ });
  mkdirSync("C:/tmp", { recursive: true });
  writeFileSync(`C:/tmp/bench-${LABEL}.json`, JSON.stringify({ rows, race: { created, outcomes, raceMs }, parallel: { parMs, parQ } }, null, 1));
}

main()
  .catch(async (e) => {
    console.error("FALHOU:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch {}
    await sql.end();
    process.exit();
  });
