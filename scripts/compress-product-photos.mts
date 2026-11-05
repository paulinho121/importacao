// Reduz as fotos de produto que já estão no Storage (PNG/JPEG grandes → WebP
// de até 1200 px), em fases separadas para nada ser apagado sem conferência:
//
//   npx tsx scripts/compress-product-photos.mts              SIMULAÇÃO: baixa e converte na
//                                                            memória, só mostra a economia.
//                                                            Não altera nada.
//   npx tsx scripts/compress-product-photos.mts --apply      FASE 1: envia o WebP novo, confere
//                                                            que abre e troca o link no banco.
//                                                            Os arquivos ORIGINAIS ficam intactos.
//   npx tsx scripts/compress-product-photos.mts --cleanup    lista os originais que já não são
//                                                            usados por nenhum produto.
//   npx tsx scripts/compress-product-photos.mts --cleanup --apply
//                                                            FASE 2: apaga esses originais.
//
// Opções: --limit N (só os N primeiros), --concurrency N (padrão 4).
// Pode ser repetido: o que já foi convertido não é refeito.

import { config } from "dotenv";
config({ path: ".env.local" });
config();
import postgres from "postgres";

const { compressPhoto } = await import("@/lib/image-compress");
const { supabaseAdmin, LOGOS_BUCKET } = await import("@/lib/supabase-admin");

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const numArg = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`);
  const n = i >= 0 ? Number(args[i + 1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const APPLY = flag("apply");
const CLEANUP = flag("cleanup");
const LIMIT = numArg("limit", Infinity);
const CONCURRENCY = numArg("concurrency", 4);

const MIN_WEBP_BYTES = 250 * 1024; // WebP que já existe só é refeito se for maior que isso
const MIN_GAIN = 0.1; // só troca se o novo for pelo menos 10% menor

const baseUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${LOGOS_BUCKET}/`;
const publicUrl = (name: string) => baseUrl + name;
const mb = (n: number) => (n / 1048576).toFixed(1) + " MB";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 2 });

type Obj = { name: string; size: number; mime: string };

async function listObjects(): Promise<Obj[]> {
  const rows = await sql<{ name: string; size: string; mime: string }[]>`
    select name, (metadata->>'size') as size, (metadata->>'mimetype') as mime
    from storage.objects
    where bucket_id = ${LOGOS_BUCKET} and name like 'produtos/%'
      and (metadata->>'mimetype') in ('image/png', 'image/jpeg', 'image/webp')
    order by name`;
  return rows.map((r) => ({ name: r.name, size: Number(r.size), mime: r.mime }));
}

async function referencedUrls(): Promise<Set<string>> {
  const a = await sql<{ url: string }[]>`select url from product_photos where url like ${baseUrl + "%"}`;
  const b = await sql<{ url: string }[]>`select photo_url as url from products where photo_url like ${baseUrl + "%"}`;
  return new Set([...a, ...b].map((r) => r.url));
}

function newNameFor(name: string, taken: Set<string>): string {
  const base = name.replace(/\.(png|jpe?g|webp)$/i, "");
  let candidate = /\.webp$/i.test(name) ? `${base}-s.webp` : `${base}.webp`;
  for (let i = 2; taken.has(candidate); i++) candidate = `${base}-s${i}.webp`;
  return candidate;
}

async function pool<T>(items: T[], worker: (item: T, index: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await worker(items[i], i);
      }
    }),
  );
}

async function download(name: string): Promise<Buffer> {
  const res = await fetch(publicUrl(name));
  if (!res.ok) throw new Error(`download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---------------------------------------------------------------- converter
async function convert() {
  const all = await listObjects();
  const refs = await referencedUrls();
  const taken = new Set(all.map((o) => o.name));
  const candidates = all
    .filter((o) => o.mime !== "image/webp" || o.size > MIN_WEBP_BYTES)
    .filter((o) => refs.has(publicUrl(o.name)))
    .slice(0, LIMIT);
  const orphans = all.filter((o) => !refs.has(publicUrl(o.name)));

  console.log(`${APPLY ? "APLICANDO" : "SIMULAÇÃO"} — ${candidates.length} fotos para converter (de ${all.length} em produtos/).`);
  console.log(`Fora do escopo: ${orphans.length} arquivos que nenhum produto usa (${mb(orphans.reduce((s, o) => s + o.size, 0))}) — não são tocados aqui.\n`);

  let before = 0, after = 0, converted = 0, skipped = 0, failed = 0;
  await pool(candidates, async (obj, i) => {
    try {
      const original = await download(obj.name);
      const out = await compressPhoto(original);
      if (out.buffer.length > original.length * (1 - MIN_GAIN)) {
        skipped++;
        return;
      }
      before += original.length;
      after += out.buffer.length;
      if (APPLY) {
        const target = newNameFor(obj.name, taken);
        taken.add(target);
        const { error } = await supabaseAdmin.storage
          .from(LOGOS_BUCKET)
          .upload(target, out.buffer, { contentType: out.contentType, upsert: false });
        if (error) throw new Error(`upload: ${error.message}`);
        const check = await fetch(publicUrl(target), { method: "HEAD" });
        if (!check.ok) throw new Error(`novo arquivo não abriu (${check.status})`);
        await sql.begin(async (tx) => {
          await tx`update product_photos set url = ${publicUrl(target)} where url = ${publicUrl(obj.name)}`;
          await tx`update products set photo_url = ${publicUrl(target)} where photo_url = ${publicUrl(obj.name)}`;
        });
      }
      converted++;
      if (converted % 50 === 0) console.log(`  … ${converted}/${candidates.length}`);
    } catch (e) {
      failed++;
      console.log(`  ✗ ${obj.name}: ${(e as Error).message}`);
    }
    void i;
  });

  console.log(`\n${APPLY ? "Convertidas" : "Seriam convertidas"}: ${converted} | sem ganho (mantidas): ${skipped} | falhas: ${failed}`);
  console.log(`Tamanho dessas fotos: ${mb(before)} → ${mb(after)}  (economia de ${mb(before - after)}, ${before ? Math.round((1 - after / before) * 100) : 0}%)`);
  if (!APPLY) console.log("\nNada foi alterado. Para executar a fase 1: --apply");
  else console.log("\nOs originais continuam no Storage. Depois de conferir o sistema: --cleanup (lista) e --cleanup --apply (apaga).");
}

// ------------------------------------------------------------------ limpeza
async function cleanup() {
  const all = await listObjects();
  const refs = await referencedUrls();
  const names = new Set(all.map((o) => o.name));
  // Original = não usado por nenhum produto E já existe uma versão WebP dele.
  const deletable = all.filter((o) => {
    if (refs.has(publicUrl(o.name))) return false;
    const base = o.name.replace(/\.(png|jpe?g|webp)$/i, "");
    return [`${base}.webp`, `${base}-s.webp`].some((n) => n !== o.name && names.has(n) && refs.has(publicUrl(n)));
  });
  const bytes = deletable.reduce((s, o) => s + o.size, 0);
  console.log(`${APPLY ? "APAGANDO" : "SIMULAÇÃO"} — ${deletable.length} originais já substituídos (${mb(bytes)}).`);
  const stillOrphan = all.length - deletable.length - all.filter((o) => refs.has(publicUrl(o.name))).length;
  if (stillOrphan > 0) console.log(`(${stillOrphan} outros arquivos sem uso e sem versão WebP foram mantidos.)`);
  if (!APPLY) {
    console.log("\nNada foi apagado. Para apagar de verdade: --cleanup --apply");
    return;
  }
  for (let i = 0; i < deletable.length; i += 100) {
    const batch = deletable.slice(i, i + 100).map((o) => o.name);
    const { error } = await supabaseAdmin.storage.from(LOGOS_BUCKET).remove(batch);
    if (error) throw new Error(`remoção falhou: ${error.message}`);
    console.log(`  apagados ${Math.min(i + 100, deletable.length)}/${deletable.length}`);
  }
  console.log(`\nLiberado: ${mb(bytes)}.`);
}

try {
  if (CLEANUP) await cleanup();
  else await convert();
} finally {
  await sql.end();
}
