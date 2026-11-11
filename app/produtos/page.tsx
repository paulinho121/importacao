import Link from "next/link";
import SupplierFilterSelect from "@/components/SupplierFilterSelect";
import CpListUpload from "@/components/CpListUpload";
import { CP_LIST_RESULT_CLASS, CP_LIST_RESULT_LABEL, type CpListResult } from "@/lib/cp-list";
import { cpStatusLabel } from "@/lib/product-flow";
import { db } from "@/db/client";
import { products, suppliers, processItems, productLpcos } from "@/db/schema";
import { and, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { BRANCHES } from "@/lib/locations";
import { LPCO_TONE_CLASS, lpcoCountdown, lpcoTone, lpcoValidUntil, productLpcoStatusLabel } from "@/lib/lpco";
import { formatDate } from "@/lib/status";

export const dynamic = "force-dynamic";

// "Deferido" = há prova de deferimento em qualquer origem: constou na lista do
// governo ou a CP está marcada como deferida (inclusive a vinda da base do
// Inciso V). A licença do Inciso V não entra mais na conta. Calculado na hora, então
// o contador acompanha qualquer importação ou edição.
const deferidoExpr = sql`coalesce(${products.cpListResult} = 'FOUND' or ${products.cpStatus} = 'POSSUI', false)`;

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; divergente?: string; semPreco?: string; fornecedor?: string; lista?: string; pagina?: string }>;
}) {
  const { q = "", divergente = "", semPreco = "", fornecedor = "", lista = "", pagina = "" } = await searchParams;
  const PAGE_SIZE = 50;
  const page = Math.max(1, Number.parseInt(pagina, 10) || 1);
  const onlyDivergent = divergente === "1";
  const onlyNoPrice = semPreco === "1";

  function buildQuery(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = {
      q,
      divergente: onlyDivergent ? "1" : "",
      semPreco: onlyNoPrice ? "1" : "",
      fornecedor,
      lista,
      pagina: "",
      ...overrides,
    };
    if (merged.q) params.set("q", merged.q);
    if (merged.divergente === "1") params.set("divergente", "1");
    if (merged.semPreco === "1") params.set("semPreco", "1");
    if (merged.fornecedor) params.set("fornecedor", merged.fornecedor);
    if (merged.lista) params.set("lista", merged.lista);
    if (merged.pagina && merged.pagina !== "1") params.set("pagina", merged.pagina);
    const qs = params.toString();
    return qs ? `/produtos?${qs}` : "/produtos";
  }

  const conditions = [
    q
      ? or(
          ilike(products.sku, `%${q}%`),
          ilike(products.manufacturerSku, `%${q}%`),
          ilike(products.description, `%${q}%`),
          ilike(products.ncm, `%${q}%`),
        )
      : undefined,
    onlyDivergent ? eq(products.ncmDivergent, true) : undefined,
    onlyNoPrice ? isNull(products.costPrice) : undefined,
    fornecedor ? eq(products.defaultSupplierId, fornecedor) : undefined,
    lista === "deferido" ? deferidoExpr : undefined,
    lista === "nacional" ? eq(products.cpListResult, "FOUND_NATIONAL") : undefined,
    lista === "aprox" ? eq(products.cpListResult, "FOUND_APPROX") : undefined,
    lista === "nao" ? sql`not ${deferidoExpr}` : undefined,
  ].filter((c) => c !== undefined);

  const [rows, [{ total }], [{ divergentCount }], [{ noPriceCount }], supplierOptions, [cpSummary]] = await Promise.all([
    db
      .select({
        id: products.id,
        sku: products.sku,
        manufacturerSku: products.manufacturerSku,
        ncm: products.ncm,
        ncmDivergent: products.ncmDivergent,
        ncmOfficialSuggested: products.ncmOfficialSuggested,
        description: products.description,
        photoUrl: products.photoUrl,
        datasheetUrl: products.datasheetUrl,
        cpListResult: products.cpListResult,
        cpStatus: products.cpStatus,
        cpListRef: products.cpListRef,
        costPrice: products.costPrice,
        costCurrency: products.costCurrency,
        markupPercent: products.markupPercent,
        supplierName: suppliers.name,
        usageCount: sql<number>`count(${processItems.id})`.mapWith(Number),
      })
      .from(products)
      .leftJoin(suppliers, eq(products.defaultSupplierId, suppliers.id))
      .leftJoin(processItems, eq(processItems.productId, products.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .groupBy(products.id, suppliers.name)
      .orderBy(products.sku)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(products)
      .where(conditions.length ? and(...conditions) : undefined),
    db
      .select({ divergentCount: sql<number>`count(*)`.mapWith(Number) })
      .from(products)
      .where(eq(products.ncmDivergent, true)),
    db
      .select({ noPriceCount: sql<number>`count(*)`.mapWith(Number) })
      .from(products)
      .where(isNull(products.costPrice)),
    db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        count: sql<number>`count(${products.id})`.mapWith(Number),
      })
      .from(suppliers)
      .innerJoin(products, eq(products.defaultSupplierId, suppliers.id))
      .groupBy(suppliers.id, suppliers.name)
      .orderBy(suppliers.name),
    db
      .select({
        found: sql<number>`count(*) filter (where ${deferidoExpr})`.mapWith(Number),
        foundNational: sql<number>`count(*) filter (where ${products.cpListResult} = 'FOUND_NATIONAL')`.mapWith(Number),
        foundApprox: sql<number>`count(*) filter (where ${products.cpListResult} = 'FOUND_APPROX')`.mapWith(Number),
        notFound: sql<number>`count(*) filter (where not ${deferidoExpr})`.mapWith(Number),
        checkedAt: sql<Date | null>`max(${products.cpListCheckedAt})`,
        source: sql<string | null>`max(${products.cpListSource})`,
      })
      .from(products),
  ]);

  // Solicitações de LPCO dos produtos listados, agrupadas por produto pra
  // mostrar o indicador por filial (a mais recente de cada filial).
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
  const latestLpco = new Map<string, (typeof lpcoRows)[number]>();
  for (const l of lpcoRows) {
    const key = `${l.productId}:${l.branch}`;
    const cur = latestLpco.get(key);
    const stamp = l.requestedAt ?? l.approvedAt ?? "";
    if (!cur || stamp > (cur.requestedAt ?? cur.approvedAt ?? "")) latestLpco.set(key, l);
  }

  type Row = (typeof rows)[number];
  const BADGE = "px-2 py-1 rounded-full font-label-md text-label-md whitespace-nowrap";

  // Só a situação da CP (a licença do Inciso V não aparece mais aqui, para não
  // duplicar a informação): resultado da lista do governo, ou a CP escolhida no cadastro.
  const licenseCp = (p: Row) => {
    if (p.cpListResult && p.cpListResult !== "NOT_FOUND") {
      return (
        <span
          className={`${BADGE} ${CP_LIST_RESULT_CLASS[p.cpListResult as CpListResult]}`}
          title={p.cpListRef ? `CP ${p.cpListRef}` : undefined}
        >
          {CP_LIST_RESULT_LABEL[p.cpListResult as CpListResult]}
          {p.cpListRef ? ` · CP ${p.cpListRef.split(", ")[0]}` : ""}
        </span>
      );
    }
    if (cpStatusLabel(p.cpStatus)) {
      // Situação da CP escolhida no cadastro (Deferida, Em análise, Indeferido…)
      const tone =
        p.cpStatus === "POSSUI"
          ? CP_LIST_RESULT_CLASS.FOUND
          : p.cpStatus === "INDEFERIDO"
            ? "bg-error-container text-on-error-container"
            : "bg-warning/20 text-warning";
      return <span className={`${BADGE} ${tone}`}>{cpStatusLabel(p.cpStatus)}</span>;
    }
    if (p.cpListResult) {
      return <span className={`${BADGE} ${CP_LIST_RESULT_CLASS.NOT_FOUND}`}>{CP_LIST_RESULT_LABEL.NOT_FOUND}</span>;
    }
    return <span className="text-on-surface-variant">—</span>;
  };

  const lpcoDots = (p: Row) => (
    <Link href={`/produtos/${p.id}`} className="flex gap-1.5">
      {BRANCHES.map((b) => {
        const l = latestLpco.get(`${p.id}:${b.code}`);
        const tone = l ? lpcoTone(l) : "none";
        const until = l?.status === "DEFERIDO" ? lpcoValidUntil(l.approvedAt, l.validUntil) : null;
        const countdown = l?.status === "DEFERIDO" ? lpcoCountdown(l.approvedAt, undefined, l.validUntil) : null;
        const title = l
          ? `${b.label}: ${productLpcoStatusLabel(l.status)}${until ? ` (até ${formatDate(until)})` : ""}`
          : `${b.label}: sem solicitação`;
        return (
          <span key={b.code} title={title} className="flex flex-col items-center gap-0.5">
            <span className="h-3 text-[11px] leading-3 text-on-surface-variant whitespace-nowrap">
              {tone === "wait" ? "em análise" : countdown && !countdown.expired ? `${countdown.daysLeft}d` : ""}
            </span>
            <span className={`px-1.5 py-0.5 rounded font-label-md text-label-md ${LPCO_TONE_CLASS[tone]}`}>{b.code}</span>
          </span>
        );
      })}
    </Link>
  );

  const money = (v: number, cur: string | null) => `${v.toFixed(2)} ${cur ?? ""}`.trim();
  const costOf = (p: Row) => (p.costPrice ? money(Number(p.costPrice), p.costCurrency) : null);
  const priceOf = (p: Row) =>
    p.costPrice && p.markupPercent ? money(Number(p.costPrice) * (1 + Number(p.markupPercent) / 100), p.costCurrency) : null;

  // Custo e preço sugerido numa coluna só (duas linhas).
  const pricing = (p: Row) => {
    const cost = costOf(p);
    const price = priceOf(p);
    if (!cost && !price) return <span className="text-on-surface-variant">—</span>;
    return (
      <div className="font-mono-data leading-tight">
        <p>
          <span className="text-[11px] text-on-surface-variant">Custo </span>
          {cost ?? "—"}
        </p>
        <p className="text-on-surface-variant">
          <span className="text-[11px]">Preço </span>
          {price ?? "—"}
        </p>
      </div>
    );
  };

  // Quando o SKU interno é igual ao nome (comum nos itens importados), o nome vira o
  // link e o SKU não aparece de novo embaixo.
  const sameSku = (p: Row) => p.sku.trim().toLowerCase() === p.description.trim().toLowerCase();
  const nameLine = (p: Row) =>
    sameSku(p) ? (
      <Link href={`/produtos/${p.id}`} className="font-medium leading-snug text-secondary hover:underline">
        {p.description}
      </Link>
    ) : (
      <p className="font-medium leading-snug">{p.description}</p>
    );

  // SKU interno (link) + SKU do fabricante só quando é diferente do interno.
  const skuLine = (p: Row) => {
    const mfr = p.manufacturerSku && p.manufacturerSku !== p.sku && p.manufacturerSku !== p.description ? p.manufacturerSku : null;
    const showSku = !sameSku(p);
    if (!showSku && !mfr && !p.datasheetUrl) return null;
    return (
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono-data text-xs">
        {showSku && (
          <Link href={`/produtos/${p.id}`} className="font-semibold text-secondary hover:underline">
            {p.sku}
          </Link>
        )}
        {mfr && (
          <span className="text-on-surface-variant" title="SKU do fabricante">
            {showSku ? "· " : "Fabr. "}
            {mfr}
          </span>
        )}
        {p.datasheetUrl && (
          <a
            href={p.datasheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-outline-variant px-2 py-0.5 text-[11px] font-bold text-secondary hover:bg-secondary/10"
            title="Abrir a ficha técnica"
          >
            <span className="material-symbols-outlined text-[14px]">description</span>
            Ficha
          </a>
        )}
      </p>
    );
  };

  const photoOf = (p: Row) =>
    p.photoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element -- foto pode vir de qualquer link externo
      <img src={p.photoUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-outline-variant bg-white object-contain" />
    ) : (
      <span
        aria-hidden
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-low text-outline"
      >
        <span className="material-symbols-outlined text-[20px]">image</span>
      </span>
    );

  const ncmLine = (p: Row) => (
    <span className="inline-flex items-center gap-1 font-mono-data text-xs text-on-surface-variant">
      NCM {p.ncm ?? "—"}
      {p.ncmDivergent && (
        <span
          className="material-symbols-outlined text-[16px] text-warning"
          title={`Lista oficial do Decex sugere: ${p.ncmOfficialSuggested ?? "—"}`}
        >
          warning
        </span>
      )}
    </span>
  );

  const emptyMessage = q
    ? "Nenhum produto encontrado para essa busca."
    : onlyDivergent
      ? "Nenhum produto com divergência de NCM no momento."
      : onlyNoPrice
        ? "Todos os produtos têm preço cadastrado."
        : fornecedor
          ? "Nenhum produto cadastrado para esse fornecedor."
          : "Nenhum produto cadastrado ainda.";

  return (
    <div className="p-6 md:p-10 max-w-[1440px] mx-auto w-full space-y-stack-lg">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-display-lg text-display-lg text-primary">Produtos</h2>
          <p className="text-on-surface-variant font-body-md text-body-md mt-1">
            Catálogo mestre com NCM e SKU do fabricante — itens de processo referenciam este
            cadastro em vez de descrição digitada solta.
          </p>
        </div>
        <Link
          href="/produtos/novo"
          className="px-6 py-2.5 rounded-lg bg-secondary text-white font-label-md text-label-md hover:bg-secondary/90 transition-all shadow-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Novo Produto
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form action="/produtos" className="flex max-w-xl flex-1 min-w-[280px] items-stretch gap-2">
          {onlyDivergent && <input type="hidden" name="divergente" value="1" />}
          {onlyNoPrice && <input type="hidden" name="semPreco" value="1" />}
          {fornecedor && <input type="hidden" name="fornecedor" value={fornecedor} />}
          {lista && <input type="hidden" name="lista" value={lista} />}
          <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
            search
          </span>
          <input
            className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:border-secondary transition-colors font-body-md text-body-md"
            placeholder="Buscar por SKU interno, SKU fabricante, descrição ou NCM..."
            type="text"
            name="q"
            defaultValue={q}
          />
          </div>
          <button
            type="submit"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-secondary px-5 font-label-md text-label-md text-white transition-all hover:opacity-90 active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">search</span>
            Buscar
          </button>
        </form>

        <SupplierFilterSelect suppliers={supplierOptions} current={fornecedor} />

        {divergentCount > 0 && (
          <Link
            href={buildQuery({ divergente: onlyDivergent ? undefined : "1" })}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-label-md text-label-md border transition-colors ${
              onlyDivergent
                ? "bg-warning text-warning-foreground border-warning"
                : "bg-warning/10 text-warning border-warning/30 hover:bg-warning/20"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">warning</span>
            {onlyDivergent ? "Mostrando só divergentes — ver todos" : `Só divergentes do Decex (${divergentCount})`}
          </Link>
        )}

        {noPriceCount > 0 && (
          <Link
            href={buildQuery({ semPreco: onlyNoPrice ? undefined : "1" })}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-label-md text-label-md border transition-colors ${
              onlyNoPrice
                ? "bg-error text-white border-error"
                : "bg-error-container/20 text-error border-error/30 hover:bg-error-container/40"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">payments</span>
            {onlyNoPrice ? "Mostrando só sem preço — ver todos" : `Sem preço cadastrado (${noPriceCount})`}
          </Link>
        )}

        {[
              { value: "deferido", label: "Deferidos", count: cpSummary.found, on: "bg-secondary text-white border-secondary", off: "bg-tertiary-fixed/40 text-on-tertiary-fixed-variant border-tertiary-fixed hover:bg-tertiary-fixed/70", icon: "verified" },
              { value: "nacional", label: "Com fabricante nacional", count: cpSummary.foundNational, on: "bg-warning text-warning-foreground border-warning", off: "bg-warning/10 text-warning border-warning/30 hover:bg-warning/20", icon: "factory" },
              { value: "aprox", label: "Possíveis (conferir)", count: cpSummary.foundApprox, on: "bg-secondary text-white border-secondary", off: "bg-secondary-fixed/40 text-on-secondary-fixed-variant border-secondary-fixed hover:bg-secondary-fixed/70", icon: "help" },
              { value: "nao", label: "Sem deferimento", count: cpSummary.notFound, on: "bg-secondary text-white border-secondary", off: "bg-surface-container-high text-on-surface-variant border-outline-variant hover:bg-surface-container-highest", icon: "schedule" },
            ]
          .filter((c) => c.count > 0)
            .map((c) => (
              <Link
                key={c.value}
                href={buildQuery({ lista: lista === c.value ? "" : c.value })}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-label-md text-label-md border transition-colors ${
                  lista === c.value ? c.on : c.off
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{c.icon}</span>
                {lista === c.value ? `Mostrando só ${c.label.toLowerCase()} — ver todos` : `${c.label} (${c.count})`}
              </Link>
            ))}
      </div>

      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 space-y-3">
        <div>
          <h3 className="font-headline-sm text-headline-sm text-primary">Importar planilhas (CP e LPCO)</h3>
          <p className="text-on-surface-variant font-body-sm text-body-sm">
            Aceita dois formatos, reconhecidos automaticamente: a lista pública do governo (.ods, &quot;Relação dos
            resultados das apurações de produção nacional&quot;), que marca quem já consta como deferido pelo SKU do
            fabricante (ou SKU interno); e a planilha de controle de LPCOs (.xlsx, colunas LPCO, Produto, Situação,
            Registro, Deferimento, Validade e UF), que registra os LPCOs de cada produto por estado; e a base de itens
            do Inciso V (.xlsx, &quot;BD Itens Amparados Inciso V&quot;), que completa NCM, fabricante, exportador,
            licença e consulta pública dos produtos, sem sobrescrever o que já foi preenchido.
          </p>
        </div>
        <CpListUpload />
        {cpSummary.checkedAt ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
            <span className="min-w-0 [overflow-wrap:anywhere]">
              Última conferência: {new Date(cpSummary.checkedAt).toLocaleString("pt-BR")} — {cpSummary.source}
            </span>
          </div>
        ) : (
          <p className="text-xs text-on-surface-variant">Nenhuma conferência feita ainda.</p>
        )}
      </section>

      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-on-surface-variant">{emptyMessage}</p>
        ) : (
          <>
            {/* Tela larga (a partir de 1360 px): tabela compacta, 7 colunas em vez de 11 */}
            <div className="hidden min-[1360px]:block">
              <table className="w-full table-fixed border-collapse text-left">
                <colgroup>
                  <col style={{ width: "34%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "17%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "4%" }} />
                  <col style={{ width: "7%" }} />
                </colgroup>
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="px-4 py-3 font-label-md text-label-md text-on-surface-variant">PRODUTO</th>
                    <th className="px-4 py-3 font-label-md text-label-md text-on-surface-variant">FORNECEDOR / NCM</th>
                    <th className="px-4 py-3 font-label-md text-label-md text-on-surface-variant">CP</th>
                    <th className="px-4 py-3 font-label-md text-label-md text-on-surface-variant">LPCO</th>
                    <th className="px-4 py-3 font-label-md text-label-md text-on-surface-variant">CUSTO / PREÇO</th>
                    <th className="px-4 py-3 font-label-md text-label-md text-on-surface-variant">USOS</th>
                    <th className="px-4 py-3 font-label-md text-label-md text-on-surface-variant text-right">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant font-body-sm text-body-sm">
                  {rows.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-container-high transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {photoOf(p)}
                          <div className="min-w-0">
                            {nameLine(p)}
                            {skuLine(p)}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <p className="truncate" title={p.supplierName ?? undefined}>
                          {p.supplierName ?? "—"}
                        </p>
                        <div className="mt-0.5">{ncmLine(p)}</div>
                      </td>
                      <td className="px-4 py-3 align-middle">{licenseCp(p)}</td>
                      <td className="px-4 py-3 align-middle">{lpcoDots(p)}</td>
                      <td className="px-4 py-3 align-middle">{pricing(p)}</td>
                      <td className="px-4 py-3 align-middle font-mono-data">{p.usageCount}</td>
                      <td className="px-4 py-3 text-right align-middle">
                        <Link
                          href={`/produtos/${p.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-secondary hover:bg-secondary/10 transition-colors font-label-md text-label-md"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                          Editar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Celular e tablet: um cartão por produto, com os mesmos dados */}
            <ul className="grid gap-3 p-3 sm:p-4 lg:grid-cols-2 min-[1360px]:hidden">
              {rows.map((p) => (
                <li key={p.id} className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-background/40 p-4">
                  <div className="flex items-start gap-3">
                    {photoOf(p)}
                    <div className="min-w-0 flex-1">
                      {nameLine(p)}
                      {skuLine(p)}
                    </div>
                    <Link
                      href={`/produtos/${p.id}`}
                      aria-label={`Editar ${p.description}`}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-secondary hover:bg-secondary/10"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </Link>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="min-w-0 truncate text-on-surface-variant">{p.supplierName ?? "Sem fornecedor"}</span>
                    {ncmLine(p)}
                  </div>

                  <div className="flex flex-wrap items-start gap-3">
                    {licenseCp(p)}
                    <div className="ml-auto">{lpcoDots(p)}</div>
                  </div>

                  <div className="flex items-end justify-between gap-3 border-t border-outline-variant pt-3 text-xs">
                    {pricing(p)}
                    <span className="text-on-surface-variant">
                      Usos: <span className="font-mono-data font-bold text-on-surface">{p.usageCount}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {total > PAGE_SIZE && (
        <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-body-sm font-body-sm text-on-surface-variant">
            Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total.toLocaleString("pt-BR")} produtos
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={buildQuery({ pagina: String(page - 1) })}
                className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-3 py-2 font-label-md text-label-md hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                Anterior
              </Link>
            ) : null}
            <span className="px-2 font-mono-data text-on-surface-variant">
              Página {page} de {Math.ceil(total / PAGE_SIZE)}
            </span>
            {page * PAGE_SIZE < total ? (
              <Link
                href={buildQuery({ pagina: String(page + 1) })}
                className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-3 py-2 font-label-md text-label-md hover:bg-surface-container-high"
              >
                Próxima
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </Link>
            ) : null}
          </div>
        </nav>
      )}
    </div>
  );
}
