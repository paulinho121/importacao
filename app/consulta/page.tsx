import Link from "next/link";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { products, suppliers, productLpcos, productPhotos } from "@/db/schema";
import ItemSearchBox from "@/components/ItemSearchBox";
import { CpBadge, ItemPhoto, ListBadge, LpcoUfChips } from "@/components/ItemStatus";
import { PageHeader } from "@/components/shared/PageHeader";
import { lpcoTone } from "@/lib/lpco";
import { hasPublicConsultation } from "@/lib/product-flow";

export const dynamic = "force-dynamic";

const MAX_RESULTS = 60;

const FILTERS = [
  { value: "", label: "Todos" },
  { value: "lpco", label: "Com LPCO vigente" },
  { value: "cp", label: "Com consulta pública" },
  { value: "foto", label: "Com foto" },
  { value: "semfoto", label: "Sem foto" },
] as const;

export default async function ConsultaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string }>;
}) {
  const { q = "", filtro = "" } = await searchParams;
  const tokens = q
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((t) => `%${t.replace(/[\\%_]/g, "\\$&")}%`);

  // Cada palavra digitada precisa aparecer em algum dos campos do item.
  const where = tokens.length
    ? and(
        ...tokens.map((t) =>
          or(
            ilike(products.sku, t),
            ilike(products.manufacturerSku, t),
            ilike(products.description, t),
            ilike(products.ncm, t),
            ilike(products.manufacturerName, t),
            ilike(products.longDescription, t),
          ),
        ),
      )
    : undefined;

  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      manufacturerSku: products.manufacturerSku,
      description: products.description,
      ncm: products.ncm,
      photoUrl: products.photoUrl,
      cpStatus: products.cpStatus,
      cpListResult: products.cpListResult,
      supplierName: suppliers.name,
    })
    .from(products)
    .leftJoin(suppliers, eq(products.defaultSupplierId, suppliers.id))
    .where(where)
    .orderBy(tokens.length ? products.description : desc(products.updatedAt))
    .limit(tokens.length ? 300 : 120);

  const lpcoRows = rows.length
    ? await db
        .select()
        .from(productLpcos)
        .where(
          inArray(
            productLpcos.productId,
            rows.map((r) => r.id),
          ),
        )
    : [];
  const photoCountRows = rows.length
    ? await db
        .select({ productId: productPhotos.productId, n: sql<number>`count(*)`.mapWith(Number) })
        .from(productPhotos)
        .where(
          inArray(
            productPhotos.productId,
            rows.map((r) => r.id),
          ),
        )
        .groupBy(productPhotos.productId)
    : [];
  const photoCount = new Map(photoCountRows.map((r) => [r.productId, r.n]));
  const lpcosByProduct = new Map<string, typeof lpcoRows>();
  for (const l of lpcoRows) lpcosByProduct.set(l.productId, [...(lpcosByProduct.get(l.productId) ?? []), l]);

  const filtered = rows.filter((r) => {
    if (filtro === "lpco") return (lpcosByProduct.get(r.id) ?? []).some((l) => lpcoTone(l) === "ok");
    if (filtro === "cp") return hasPublicConsultation(r);
    if (filtro === "foto") return Boolean(r.photoUrl);
    if (filtro === "semfoto") return !r.photoUrl;
    return true;
  });
  const shown = filtered.slice(0, MAX_RESULTS);

  const chipHref = (value: string) => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (value) params.set("filtro", value);
    const qs = params.toString();
    return qs ? `/consulta?${qs}` : "/consulta";
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 pb-12">
      <PageHeader title="Consulta de Itens" description="Pesquise um item e veja a foto, a situação fiscal e os benefícios" />

      <div className="space-y-5 px-4 lg:px-6">
        <ItemSearchBox defaultValue={q} filtro={filtro} />

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={chipHref(f.value)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                filtro === f.value
                  ? "border-secondary bg-secondary text-white"
                  : "border-outline-variant text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {f.label}
            </Link>
          ))}
          <span className="ml-auto text-sm text-on-surface-variant">
            {q.trim() ? `${filtered.length} resultado(s)` : "Itens atualizados recentemente"}
            {filtered.length > MAX_RESULTS ? ` — mostrando ${MAX_RESULTS}, refine a pesquisa` : ""}
          </span>
        </div>

        {shown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outline-variant p-12 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[40px] text-outline-variant">search_off</span>
            <p className="mt-2 font-medium">Nenhum item encontrado</p>
            <p className="text-sm">Tente outro nome, SKU ou NCM.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/consulta/${p.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative">
                    <ItemPhoto url={p.photoUrl} alt={p.description} className="aspect-[4/3] border-b border-outline-variant" />
                    {(photoCount.get(p.id) ?? 0) > 1 && (
                      <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-white">
                        {photoCount.get(p.id)} fotos
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="line-clamp-2 font-semibold text-primary group-hover:text-secondary">{p.description}</h3>
                    <p className="font-mono-data text-xs text-on-surface-variant">
                      {p.manufacturerSku ?? p.sku}
                      {p.ncm ? ` · NCM ${p.ncm}` : ""}
                    </p>
                    {p.supplierName && <p className="text-xs text-on-surface-variant">{p.supplierName}</p>}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <CpBadge cpStatus={p.cpStatus} cpListResult={p.cpListResult} />
                      <ListBadge cpListResult={p.cpListResult} />
                    </div>
                    <div className="mt-auto pt-2">
                      <LpcoUfChips lpcos={lpcosByProduct.get(p.id) ?? []} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
