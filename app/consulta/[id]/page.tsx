import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { products, suppliers, productLpcos, processItems, processes } from "@/db/schema";
import { CpBadge, ItemPhoto, ListBadge } from "@/components/ItemStatus";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { BRANCHES } from "@/lib/locations";
import {
  LPCO_COUNTDOWN_BAR,
  LPCO_TONE_CLASS,
  lpcoCountdown,
  lpcoTone,
  lpcoValidUntil,
  productLpcoStatusLabel,
} from "@/lib/lpco";
import { CP_STATUS_OPTIONS } from "@/lib/product-flow";
import { LICENSE_STATUS_LABEL, formatDate, type LicenseStatus, type ProcessStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{label}</dt>
      <dd className={`mt-0.5 text-body-md ${mono ? "font-mono-data" : ""}`}>{value || "—"}</dd>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
      <h2 className="mb-4 flex items-center gap-2 font-headline-sm text-headline-sm text-primary">
        <span className="material-symbols-outlined text-[20px] text-secondary">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function ItemFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [item] = await db
    .select({ p: products, supplierName: suppliers.name })
    .from(products)
    .leftJoin(suppliers, eq(products.defaultSupplierId, suppliers.id))
    .where(eq(products.id, id));
  if (!item) notFound();
  const p = item.p;

  const [lpcos, usage] = await Promise.all([
    db.select().from(productLpcos).where(eq(productLpcos.productId, id)),
    db
      .select({
        id: processes.id,
        processNumber: processes.processNumber,
        status: processes.status,
        quantity: processItems.quantity,
        etaEstimated: processes.etaEstimated,
      })
      .from(processItems)
      .innerJoin(processes, eq(processItems.processId, processes.id))
      .where(eq(processItems.productId, id))
      .orderBy(desc(processes.createdAt))
      .limit(15),
  ]);

  const carton =
    p.cartonLengthCm && p.cartonWidthCm && p.cartonHeightCm
      ? (Number(p.cartonLengthCm) * Number(p.cartonWidthCm) * Number(p.cartonHeightCm)) / 1_000_000
      : null;
  const cpLabel = CP_STATUS_OPTIONS.find((o) => o.value === p.cpStatus)?.label;

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 p-4 pb-12 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/consulta" className="group flex items-center gap-2 font-semibold text-secondary hover:underline">
          <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1">arrow_back</span>
          <span className="font-label-md text-label-md">VOLTAR PARA A CONSULTA</span>
        </Link>
        <Link
          href={`/produtos/${p.id}`}
          className="flex items-center gap-2 rounded-lg border border-outline-variant px-4 py-2 font-label-md text-label-md text-on-surface-variant transition-all hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined text-[18px]">edit</span>
          Editar cadastro
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(260px,380px)_1fr]">
        <div>
          {p.photoUrl ? (
            <a href={p.photoUrl} target="_blank" rel="noopener noreferrer" title="Abrir a imagem em tamanho original">
              <ItemPhoto
                url={p.photoUrl}
                alt={p.description}
                className="aspect-square rounded-xl border border-outline-variant"
              />
            </a>
          ) : (
            <ItemPhoto url={null} alt={p.description} className="aspect-square rounded-xl border border-dashed border-outline-variant" />
          )}
          {!p.photoUrl && (
            <p className="mt-2 text-xs text-on-surface-variant">
              Sem foto —{" "}
              <Link href={`/produtos/${p.id}`} className="text-secondary hover:underline">
                adicionar no cadastro
              </Link>
              .
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CpBadge cpStatus={p.cpStatus} cpListResult={p.cpListResult} />
              <ListBadge cpListResult={p.cpListResult} />
              {!p.active && (
                <span className="rounded-full bg-error-container px-2 py-0.5 text-xs font-bold text-on-error-container">
                  Inativo
                </span>
              )}
            </div>
            <h1 className="mt-2 font-display-lg text-display-lg leading-tight text-primary">{p.description}</h1>
            <p className="mt-1 font-mono-data text-on-surface-variant">{p.manufacturerSku ?? p.sku}</p>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 sm:grid-cols-3">
            <Field label="SKU interno" value={p.sku} mono />
            <Field label="SKU do fabricante" value={p.manufacturerSku} mono />
            <Field label="NCM vigente" value={p.ncm} mono />
            <Field label="Fornecedor padrão" value={item.supplierName} />
            <Field label="Fabricante" value={p.manufacturerName} />
            <Field label="Exportador" value={p.exporterName} />
          </dl>

          {p.longDescription && (
            <div>
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Descrição</h2>
              <p className="whitespace-pre-wrap text-body-md leading-relaxed">{p.longDescription}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Consulta Pública e licença" icon="gavel">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Situação da CP" value={cpLabel ?? "Ainda não verificado"} />
            <Field label="Referência da CP" value={p.publicConsultationRef} />
            <Field label="Solicitada em" value={p.cpRequestedAt ? formatDate(p.cpRequestedAt) : null} />
            <Field label="Resultado da CP" value={p.publicConsultationDate ? formatDate(p.publicConsultationDate) : null} />
            <Field
              label="Lista do governo"
              value={
                p.cpListResult
                  ? `${p.cpListResult === "NOT_FOUND" ? "Não consta" : "Consta"}${p.cpListRef ? ` (CP ${p.cpListRef})` : ""}`
                  : null
              }
            />
            <Field label="Conferido em" value={p.cpListCheckedAt ? new Date(p.cpListCheckedAt).toLocaleDateString("pt-BR") : null} />
            <Field label="NCM anterior" value={p.ncmAnterior} mono />
            <Field
              label="Licença (Inciso V)"
              value={
                p.licenseStatus
                  ? `${LICENSE_STATUS_LABEL[p.licenseStatus as LicenseStatus]}${p.licenseNumber ? ` · ${p.licenseNumber}` : ""}`
                  : null
              }
            />
          </dl>
        </Card>

        <Card title="Benefício por estado (LPCO)" icon="verified">
          <div className="space-y-4">
            {BRANCHES.map((b) => {
              const list = lpcos
                .filter((l) => l.branch === b.code)
                .sort((x, y) => (y.requestedAt ?? y.approvedAt ?? "").localeCompare(x.requestedAt ?? x.approvedAt ?? ""));
              const current = list[0];
              const tone = current ? lpcoTone(current) : "none";
              const c = current?.status === "DEFERIDO" ? lpcoCountdown(current.approvedAt, undefined, current.validUntil) : null;
              return (
                <div key={b.code}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-primary">{b.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${LPCO_TONE_CLASS[tone]}`}>
                      {current ? productLpcoStatusLabel(current.status) : "Sem solicitação"}
                    </span>
                    {current?.lpcoNumber && <span className="font-mono-data text-xs text-on-surface-variant">Nº {current.lpcoNumber}</span>}
                  </div>
                  {c && current && (
                    <div className="mt-1.5">
                      <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
                        <div className={`h-full ${LPCO_COUNTDOWN_BAR[c.level]}`} style={{ width: `${c.pctLeft}%` }} />
                      </div>
                      <p className="mt-0.5 text-xs text-on-surface-variant">
                        {c.expired ? `Vencido há ${Math.abs(c.daysLeft)} dias` : `Faltam ${c.daysLeft} de ${c.total} dias`} · vale até{" "}
                        {formatDate(lpcoValidUntil(current.approvedAt, current.validUntil))}
                      </p>
                    </div>
                  )}
                  {list.length > 1 && (
                    <p className="mt-1 text-xs text-on-surface-variant">{list.length - 1} solicitação(ões) anterior(es) no histórico</p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {carton !== null && (
          <Card title="Embalagem (carton)" icon="inventory_2">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Field label="Peças por carton" value={p.cartonPiecesPerCarton} />
              <Field label="Medidas (C × L × A)" value={`${p.cartonLengthCm} × ${p.cartonWidthCm} × ${p.cartonHeightCm} cm`} />
              <Field label="Peso bruto" value={p.cartonWeightKg ? `${p.cartonWeightKg} kg` : null} />
              <Field
                label="Cubagem por carton"
                value={`${carton.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m³`}
              />
            </dl>
          </Card>
        )}

        <Card title="Uso em processos" icon="local_shipping">
          {usage.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">Este item ainda não foi usado em nenhum processo.</p>
          ) : (
            <ul className="divide-y divide-outline-variant/60">
              {usage.map((u) => (
                <li key={u.id}>
                  <Link
                    href={`/processos/${u.id}`}
                    className="flex items-center gap-3 py-2 transition-colors hover:text-secondary"
                  >
                    <span className="font-mono-data text-sm">{u.processNumber}</span>
                    <StatusBadge status={u.status as ProcessStatus} />
                    <span className="ml-auto text-xs text-on-surface-variant">
                      {u.quantity ? `${Number(u.quantity)} un.` : ""}
                      {u.etaEstimated ? ` · ETA ${formatDate(u.etaEstimated)}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
