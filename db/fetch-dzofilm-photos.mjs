// Fotos da DZOFILM (dzofilm.com/en) por SÉRIE: o site é de divulgação (Framer),
// não tem SKU nem foto por distância focal — cada página de série traz um
// conjunto de imagens. O script associa cada produto da DZO do catálogo à
// página da série pelo nome ("Pavo 40mm…" -> série Pavo) e grava as imagens
// da série na galeria do produto (product_photos) + Storage do Supabase.
//
//   node db/fetch-dzofilm-photos.mjs            -> simulação (não grava nada)
//   node db/fetch-dzofilm-photos.mjs --apply    -> baixa e grava
//   (--cache=arquivo.json guarda a leitura das páginas)
//
// Só mexe em produtos SEM foto. Imagens do fabricante, uso interno no cadastro.

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import fs from "node:fs";
import crypto from "node:crypto";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const APPLY = process.argv.includes("--apply");
const CACHE = arg("cache");
const SITE = "https://dzofilm.com/en";
const UA = "Mozilla/5.0 (compatible; MCI-catalog-sync)";
const DELAY_MS = 1200;
const MAX_PER_SERIES = 3; // as primeiras costumam ser fotos do produto; as seguintes viram cenas de filmes e bastidores
const MIN_WIDTH = 700; // descarta ícones, logos e miniaturas
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const BUCKET = "supplier-logos";

// Nome do produto -> página da série (a primeira regra que casar vale).
const SERIES = [
  [/arcana/i, "lens/anamorphic/arcana-1.5x"],
  [/lustre/i, "lens/prime/arles-lustre"],
  [/arles/i, "lens/prime/arles-prime"],
  [/catta\s*ace/i, "lens/zoom/catta-ace"],
  [/catta/i, "lens/zoom/catta-zoom"],
  [/pavo/i, "lens/anamorphic/pavo"],
  [/pictor/i, "lens/zoom/pictor-zoom"],
  [/tango/i, "lens/zoom/tango-zoom"],
  [/vespid\s*prime\s*2/i, "lens/prime/vespid-prime2"],
  [/vespid\s*retro/i, "lens/prime/vespid-retro"],
  [/vespid\s*cyber/i, "lens/prime/vespid-cyber"],
  [/vespid/i, "lens/prime/vespid-prime"],
  [/x-?tract/i, "lens/macro-probe/x-tract"],
  [/gnosis/i, "lens/macro-probe/gnosis-macro"],
  [/linglung/i, "lens/zoom/linglung"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const assetId = (u) => u.split("?")[0];

async function politeFetch(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status !== 429) return res;
    const wait = (Number(res.headers.get("retry-after")) || 60) + 5;
    console.log(`  429 — aguardando ${wait}s`);
    await res.body?.cancel();
    await sleep(wait * 1000);
  }
  throw new Error(`${url} -> HTTP 429 persistente`);
}

// Imagens hospedadas no CDN do Framer, com a largura original quando vem na URL.
function imagesOf(html) {
  const found = [];
  for (const m of html.matchAll(/https:\/\/framerusercontent\.com\/images\/[A-Za-z0-9]+\.(?:png|jpe?g|webp)[^"'\s,)]*/g)) {
    const url = m[0].replaceAll("&amp;", "&");
    const width = Number(url.match(/[?&]width=(\d+)/)?.[1] ?? 0);
    found.push({ url, width });
  }
  // uma entrada por imagem (a de maior largura informada), na ordem em que aparece
  const best = new Map();
  for (const f of found) {
    const id = assetId(f.url);
    if (!best.has(id) || f.width > best.get(id).width) best.set(id, f);
  }
  return [...best.values()];
}

function imageKind(buf) {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ["png", "image/png"];
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ["jpg", "image/jpeg"];
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return ["webp", "image/webp"];
  return null;
}

async function downloadImage(rawUrl) {
  const url = new URL(rawUrl);
  url.search = "";
  url.searchParams.set("scale-down-to", "1200"); // o Framer redimensiona pelo parâmetro
  const res = await politeFetch(url.toString());
  if (!res.ok) throw new Error(`imagem HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) throw new Error(`imagem grande demais (${buf.length} bytes)`);
  const kind = imageKind(buf); // confere pelo conteúdo, não pelo que o servidor diz
  if (!kind) throw new Error("o arquivo baixado não é PNG/JPEG/WebP");
  return { buf, ext: kind[0], type: kind[1] };
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const catalog = await sql`
  select p.id, p.sku, p.description from products p
  where p.photo_url is null and not exists (select 1 from product_photos f where f.product_id = p.id)`;
const bySeries = new Map();
const noSeries = [];
for (const p of catalog) {
  const name = `${p.sku} ${p.description}`;
  const hit = SERIES.find(([re]) => re.test(name));
  if (!hit) continue;
  bySeries.set(hit[1], [...(bySeries.get(hit[1]) ?? []), p]);
}
console.log(`Produtos sem foto que casam com uma série: ${[...bySeries.values()].flat().length} em ${bySeries.size} série(s)`);

// ---- páginas das séries (e de duas páginas de referência pra achar o que é do site todo) ----
let pages = CACHE && fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : null;
if (!pages) {
  pages = {};
  const wanted = [...bySeries.keys(), "accessories", "lens"];
  for (const path of wanted) {
    const res = await politeFetch(`${SITE}/${path}`);
    pages[path] = res.ok ? imagesOf(await res.text()) : [];
    console.log(`  ${path}: ${pages[path].length} imagens`);
    await sleep(DELAY_MS);
  }
  if (CACHE) fs.writeFileSync(CACHE, JSON.stringify(pages));
}
// imagem que aparece em várias páginas = parte do site (menu, rodapé), não da série
const seenIn = new Map();
for (const imgs of Object.values(pages)) for (const f of imgs) seenIn.set(assetId(f.url), (seenIn.get(assetId(f.url)) ?? 0) + 1);

const plan = [];
for (const [path, prods] of bySeries) {
  const imgs = (pages[path] ?? []).filter((f) => f.width >= MIN_WIDTH && (seenIn.get(assetId(f.url)) ?? 0) <= 2).slice(0, MAX_PER_SERIES);
  plan.push({ path, prods, imgs });
  console.log(`\n${path} -> ${prods.length} produto(s): ${prods.map((p) => p.sku).join(" | ")}`);
  for (const f of imgs) console.log(`   ${f.width}px ${assetId(f.url).split("/").pop()}`);
}
const total = plan.reduce((n, x) => n + x.imgs.length * x.prods.length, 0);
console.log(`\nFotos a gravar: ${total} (${plan.reduce((n, x) => n + x.imgs.length, 0)} imagens distintas)`);

if (!APPLY) {
  console.log("Simulação: nada foi gravado. Rode com --apply para baixar e salvar.");
  await sql.end();
  process.exit(0);
}

let saved = 0;
const failures = [];
for (const { imgs, prods } of plan) {
  const files = [];
  for (const f of imgs) {
    try {
      files.push({ f, ...(await downloadImage(f.url)) });
    } catch (e) {
      failures.push(`${assetId(f.url)}: ${e.message}`);
    }
    await sleep(300);
  }
  for (const p of prods) {
    let position = 0;
    for (const { f, buf, ext, type } of files) {
      const key = crypto.createHash("sha1").update(assetId(f.url)).digest("hex").slice(0, 8);
      const path = `produtos/${p.id}-${key}.${ext}`;
      const up = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: type, upsert: true });
      if (up.error) {
        failures.push(`${p.sku}: ${up.error.message}`);
        continue;
      }
      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      await sql`insert into product_photos (product_id, url, position, source_url) values (${p.id}, ${url}, ${position++}, ${assetId(f.url)}) on conflict do nothing`;
      saved++;
    }
    await sql`update products set photo_url = (select url from product_photos where product_id = ${p.id} order by position, created_at limit 1), updated_at = now() where id = ${p.id} and photo_url is null`;
  }
}
console.log(`\nFotos salvas: ${saved} | falhas: ${failures.length}`);
for (const f of failures.slice(0, 10)) console.log("  ", f);
await sql.end();
