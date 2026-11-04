// Busca no site do fabricante (Aputure: aputure.com; amaran: amarancreators.com)
// as fotos de cada produto do nosso catálogo, pelo SKU do fabricante, e salva
// no Storage do Supabase + na galeria do produto (tabela product_photos).
// Os dois sites são lojas Shopify (Hydrogen) com o mesmo formato de página.
//
//   node db/fetch-aputure-photos.mjs                  -> simulação: só mostra o que casaria
//   node db/fetch-aputure-photos.mjs --apply          -> baixa as imagens e grava
//   node db/fetch-aputure-photos.mjs --site=https://amarancreators.com --delay=2500
//   (--cache=arquivo.json guarda a leitura do site pra não repetir)
//
// Regras: só mexe em produtos sem foto ou cujas fotos já vieram deste site
// (nunca em fotos que alguém cadastrou à mão); não baixa a mesma imagem duas
// vezes; respeita o limite de requisições do site (429 + Retry-After).
// As imagens são do fabricante (nosso fornecedor), para uso interno no cadastro.

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import fs from "node:fs";
import crypto from "node:crypto";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const APPLY = process.argv.includes("--apply");
const CACHE = arg("cache");
const SITE = (arg("site") ?? "https://aputure.com").replace(/\/$/, "");
const SITE_HOST = new URL(SITE).hostname.replace(/^www\./, "");
const UA = "Mozilla/5.0 (compatible; MCI-catalog-sync; uso interno)";
let DELAY_MS = Number(arg("delay") ?? 400);
const MAX_PHOTOS = 8;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const BUCKET = "supplier-logos";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (v) => String(v ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
// Endereço sem parâmetros (?v=…): identifica a imagem de origem.
const baseUrl = (u) => String(u).split("?")[0];

// GET respeitando o limite de requisições do site: em 429 espera o tempo
// pedido em Retry-After (ou 65 s), reduz o ritmo e tenta de novo.
async function politeFetch(url) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status !== 429) return res;
    const wait = (Number(res.headers.get("retry-after")) || 60) + 5;
    DELAY_MS = Math.min(DELAY_MS * 1.5, 8000);
    console.log(`  429 (limite do site) — aguardando ${wait}s; ritmo agora ${Math.round(DELAY_MS)} ms`);
    await res.body?.cancel();
    await sleep(wait * 1000);
  }
  throw new Error(`${url} -> HTTP 429 persistente`);
}

async function getText(url) {
  const res = await politeFetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

async function listProductUrls() {
  const index = await getText(`${SITE}/sitemap.xml`);
  const maps = [...index.matchAll(/<loc>([^<]*sitemap\/products\/[^<]*)<\/loc>/g)].map((m) => m[1]);
  const urls = new Set();
  for (const m of maps) {
    const xml = await getText(m);
    for (const x of xml.matchAll(/<loc>(https:\/\/[^<]*\/products\/[^<]+)<\/loc>/g)) urls.add(x[1]);
    await sleep(DELAY_MS);
  }
  // aputure.com: usa a versão en-US das páginas
  return [...urls].map((u) => (SITE_HOST === "aputure.com" ? u.replace("/products/", "/en-US/products/") : u));
}

// Lê a página até a lista de variantes (onde a galeria do produto termina) em
// vez de baixar os ~600 KB inteiros.
async function readHead(url) {
  const res = await politeFetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const sel = buf.indexOf("&quot;selectedVariant&quot;");
    const im = sel >= 0 ? buf.indexOf("\\&quot;images\\&quot;", sel) : -1;
    if (im >= 0 && buf.length > im + 4000) break;
    if (buf.length > 1_500_000) break;
  }
  await reader.cancel();
  return buf.replaceAll("&quot;", '"').replaceAll("&amp;", "&");
}

// Fotos do produto: a imagem da variante selecionada + o grupo de imagens
// (gid ProductImage -> url) que antecede a lista de variantes no fluxo de
// dados da página. Imagens de produtos relacionados ficam fora do grupo.
function parseProduct(html, url) {
  const handle = url.split("/products/")[1];
  const title = (html.match(/<title>\s*([^<]*)/)?.[1] ?? "").trim();
  const i = html.indexOf('"selectedVariant"');
  const chunk = i >= 0 ? html.slice(i, i + 2500) : "";
  const sku = chunk.match(/"sku":"([^"]*)"/)?.[1] ?? html.match(/SKU: <!-- -->([A-Za-z0-9._-]+)/)?.[1] ?? null;
  const selectedImage = chunk.match(/"image":\{[^}]*?"url":"(https:[^"]+)"/)?.[1] ?? html.match(/og:image" content="([^"]+)"/)?.[1] ?? null;

  const gallery = [];
  if (selectedImage) gallery.push(selectedImage);
  // Galeria do produto: grupo contíguo de pares (gid ProductImage -> url) logo
  // depois da chave "images" do fluxo de dados da página. Imagens de produtos
  // relacionados vêm em outros grupos e ficam fora.
  const imagesKey = html.indexOf('\\"images\\"', i >= 0 ? i : 0);
  if (imagesKey >= 0) {
    const pairs = [...html.matchAll(/gid:\/\/shopify\/ProductImage\/\d+\\",\\"(https:\/\/cdn\.shopify\.com\/[^\\"]+)\\"/g)];
    let edge = imagesKey;
    for (const m of pairs) {
      if (m.index < imagesKey) continue;
      if (m.index - edge > 600) break;
      gallery.push(m[1]);
      edge = m.index + m[0].length;
    }
  }
  const seen = new Set();
  const images = gallery.filter((u) => {
    const b = baseUrl(u);
    if (seen.has(b)) return false;
    seen.add(b);
    return true;
  });
  return { handle, title, sku, image: selectedImage, gallery: images.slice(0, MAX_PHOTOS) };
}

async function crawlAll() {
  const urls = await listProductUrls();
  console.log(`Produtos no site: ${urls.length}`);
  const out = [];
  let n = 0;
  for (const url of urls) {
    try {
      out.push(parseProduct(await readHead(url), url));
    } catch (e) {
      out.push({ handle: url.split("/products/")[1], error: String(e.message ?? e) });
    }
    if (++n % 50 === 0) console.log(`  ${n}/${urls.length}`);
    await sleep(DELAY_MS);
  }
  return out;
}

function imageKind(buf) {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ["png", "image/png"];
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ["jpg", "image/jpeg"];
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return ["webp", "image/webp"];
  return null;
}

async function downloadImage(rawUrl) {
  // A CDN da Shopify redimensiona pelo parâmetro width (evita imagens enormes).
  const url = new URL(rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl);
  url.searchParams.set("width", "1000");
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

// ---- 1) leitura do site (com cache) ----------------------------------------
const site = CACHE && fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : await crawlAll();
const save = () => CACHE && fs.writeFileSync(CACHE, JSON.stringify(site));
save();
const bySku = new Map();
for (const p of site) if (p.sku && (p.image || p.gallery?.length)) bySku.set(norm(p.sku), p);
console.log(`Páginas: ${site.length} | com SKU e imagem: ${bySku.size} | com erro: ${site.filter((p) => p.error).length}`);

// ---- 2) produtos do catálogo ----------------------------------------------------
const catalog = await sql`
  select p.id, p.sku, p.manufacturer_sku, p.description
  from products p join suppliers s on s.id = p.default_supplier_id
  where s.name ilike '%aputure%'`;
const photoRows = await sql`select product_id, url, source_url from product_photos where product_id in ${sql(catalog.map((c) => c.id))}`;
const photosOf = new Map();
for (const r of photoRows) photosOf.set(r.product_id, [...(photosOf.get(r.product_id) ?? []), r]);

const matched = [];
const noMatch = [];
let skippedManual = 0;
for (const p of catalog) {
  const hit = bySku.get(norm(p.manufacturer_sku)) ?? bySku.get(norm(p.sku));
  const own = photosOf.get(p.id) ?? [];
  // foto "à mão" = não veio deste script (sem source_url e fora de produtos/<id>.ext)
  // ou veio de OUTRA loja (a Aputure e a amaran têm lojas diferentes na Shopify:
  // o produto que já tem fotos de uma delas não recebe as da outra).
  const store = (u) => String(u).match(/\/s\/files\/(\d+\/\d+\/\d+\/\d+)/)?.[1];
  const hitStore = store(hit?.gallery?.[0] ?? hit?.image ?? "");
  const manual =
    own.some((r) => !r.source_url && !r.url.includes(`/produtos/${p.id}.`)) ||
    own.some((r) => r.source_url && store(r.source_url) && hitStore && store(r.source_url) !== hitStore);
  if (!hit) {
    if (own.length === 0) noMatch.push(p);
    continue;
  }
  if (manual) {
    skippedManual++;
    continue;
  }
  matched.push({ p, hit, own });
}

// páginas lidas numa versão antiga do cache (sem galeria): relê só as dos produtos casados
for (const { hit } of matched) {
  if (hit.gallery) continue;
  const url = `${SITE}${SITE_HOST === "aputure.com" ? "/en-US" : ""}/products/${hit.handle}`;
  try {
    Object.assign(hit, parseProduct(await readHead(url), url));
  } catch (e) {
    hit.gallery = hit.image ? [hit.image] : [];
    console.log(`  falha ao reler ${hit.handle}: ${e.message}`);
  }
  await sleep(DELAY_MS);
}
save();

// ---- 3) o que falta baixar ----------------------------------------------------
const plan = [];
for (const { p, hit, own } of matched) {
  const have = new Set(own.map((r) => r.source_url).filter(Boolean));
  const gallery = hit.gallery?.length ? hit.gallery : [hit.image];
  // foto principal salva por uma versão anterior do script = 1ª imagem da galeria
  const legacy = own.find((r) => !r.source_url && r.url.includes(`/produtos/${p.id}.`));
  if (legacy) have.add(baseUrl(gallery[0]));
  const missing = gallery.filter((u) => !have.has(baseUrl(u)));
  if (missing.length > 0 || legacy) plan.push({ p, legacy, gallery, missing, own });
}
const totalImages = plan.reduce((n, x) => n + x.missing.length, 0);
console.log(`Catálogo (fornecedor Aputure): ${catalog.length} | casam por SKU: ${matched.length} | pulados (foto cadastrada à mão): ${skippedManual}`);
console.log(`Produtos a atualizar: ${plan.length} | imagens a baixar: ${totalImages} | sem foto e sem correspondência: ${noMatch.length}`);

const nearList = noMatch
  .map((p) => {
    const k = norm(p.manufacturer_sku).slice(0, 8);
    const hit = k.length === 8 ? site.find((x) => x.sku && norm(x.sku).startsWith(k)) : null;
    return hit ? `${p.manufacturer_sku} (${p.description}) ~ ${hit.sku} (${hit.handle})` : null;
  })
  .filter(Boolean);
console.log(`SKUs quase iguais (não aplicados): ${nearList.length}`);
for (const l of nearList.slice(0, 15)) console.log("  ", l);
console.log("Exemplos sem correspondência:", noMatch.slice(0, 8).map((p) => `${p.manufacturer_sku ?? "(sem sku fab.)"} | ${p.description}`));

if (!APPLY) {
  console.log("\nSimulação: nada foi gravado. Rode com --apply para baixar e salvar.");
  await sql.end();
  process.exit(0);
}

// ---- 4) grava ------------------------------------------------------------------
let saved = 0;
const failures = [];
for (const { p, legacy, gallery, missing, own } of plan) {
  try {
    // a principal salva antes passa a registrar de onde veio
    if (legacy) await sql`update product_photos set source_url = ${baseUrl(gallery[0])} where product_id = ${p.id} and url = ${legacy.url} and source_url is null`;
    let position = own.length;
    for (const imageUrl of missing) {
      const { buf, ext, type } = await downloadImage(imageUrl);
      const key = crypto.createHash("sha1").update(baseUrl(imageUrl)).digest("hex").slice(0, 8);
      const path = `produtos/${p.id}-${key}.${ext}`;
      const up = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: type, upsert: true });
      if (up.error) throw new Error(up.error.message);
      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      await sql`insert into product_photos (product_id, url, position, source_url) values (${p.id}, ${url}, ${position++}, ${baseUrl(imageUrl)}) on conflict do nothing`;
      saved++;
      await sleep(200);
    }
    await sql`update products set photo_url = (select url from product_photos where product_id = ${p.id} order by position, created_at limit 1), updated_at = now() where id = ${p.id}`;
  } catch (e) {
    failures.push(`${p.manufacturer_sku}: ${e.message}`);
  }
}
console.log(`\nFotos salvas: ${saved} | produtos com falha: ${failures.length}`);
for (const f of failures.slice(0, 10)) console.log("  ", f);
await sql.end();
