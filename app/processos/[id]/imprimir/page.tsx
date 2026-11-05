import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray, isNotNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import {
  processes,
  suppliers,
  freightAgents,
  processItems,
  products,
  processInvoices,
  processLpcos,
  processEvents,
} from "@/db/schema";
import PrintButton from "@/components/PrintButton";
import { branchLabel, landingLabel } from "@/lib/locations";
import { modalidadeLabel, tipoEmbarqueLabel } from "@/lib/modais";
import {
  CUSTOMS_CHANNEL_LABEL,
  LICENSE_STATUS_LABEL,
  STATUS_LABEL,
  WORKFLOW_STEPS,
  formatDate,
  type CustomsChannel,
  type LicenseStatus,
  type ProcessStatus,
} from "@/lib/status";

export const dynamic = "force-dynamic";

// Cores fixas (não usam os tokens de tema claro/escuro do app) porque este
// documento é impresso/exportado em PDF e precisa ficar sempre igual,
// independente do tema escolhido na tela — mesmo padrão do PO impresso.
const INK = "#0f172a";
const ACCENT = "#2abf9c";
const MUTED = "#64748b";
const LINE = "#d8e0e9";

function money(value: string | number | null, currency: string | null) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  if (currency && currency !== "OTHER") {
    try {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
    } catch {
      // moeda com código inválido pro Intl — cai no número simples abaixo
    }
  }
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function yesNo(value: boolean | null) {
  if (value === null) return "—";
  return value ? "Sim" : "Não";
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
        {label}
      </p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-xs font-bold uppercase tracking-wider pb-1.5 mb-3 border-b"
      style={{ color: ACCENT, borderColor: LINE }}
    >
      {children}
    </h2>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`py-2 pr-3 text-[10px] font-semibold uppercase tracking-wider ${right ? "text-right" : ""}`}
      style={{ color: MUTED }}
    >
      {children}
    </th>
  );
}

export default async function ProcessoImprimirPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [p] = await db
    .select({
      processNumber: processes.processNumber,
      externalReference: processes.externalReference,
      status: processes.status,
      modal: processes.modal,
      containerType: processes.containerType,
      etd: processes.etd,
      etaEstimated: processes.etaEstimated,
      etaActual: processes.etaActual,
      destination: processes.destination,
      destinationCode: processes.destinationCode,
      destinationCity: processes.destinationCity,
      destinationState: processes.destinationState,
      destinationBranch: processes.destinationBranch,
      currentStep: processes.currentStep,
      weightKg: processes.weightKg,
      volumeM3: processes.volumeM3,
      notes: processes.notes,
      currency: processes.currency,
      incoterm: processes.incoterm,
      internationalFreightValue: processes.internationalFreightValue,
      insuranceValue: processes.insuranceValue,
      exchangeRate: processes.exchangeRate,
      customsChannel: processes.customsChannel,
      trackingNumber: processes.trackingNumber,
      closedAt: processes.closedAt,
      customsDeclarationNumber: processes.customsDeclarationNumber,
      vesselName: processes.vesselName,
      supplierName: suppliers.name,
      supplierLogoUrl: suppliers.logoUrl,
      agentName: freightAgents.name,
    })
    .from(processes)
    .innerJoin(suppliers, eq(processes.supplierId, suppliers.id))
    .leftJoin(freightAgents, eq(processes.agentId, freightAgents.id))
    .where(eq(processes.id, id));

  if (!p) notFound();

  const [items, invoices, lpcos, events] = await Promise.all([
    // foto do cadastro do produto (quando o item veio do catálogo e o produto tem foto)
    db
      .select({ item: processItems, photoUrl: products.photoUrl })
      .from(processItems)
      .leftJoin(products, eq(processItems.productId, products.id))
      .where(eq(processItems.processId, id))
      .orderBy(asc(processItems.createdAt))
      .then((rows) => rows.map((r) => ({ ...r.item, photoUrl: r.photoUrl }))),
    db
      .select({
        id: processInvoices.id,
        invoiceNumber: processInvoices.invoiceNumber,
        value: processInvoices.value,
        supplierName: suppliers.name,
      })
      .from(processInvoices)
      .leftJoin(suppliers, eq(processInvoices.supplierId, suppliers.id))
      .where(eq(processInvoices.processId, id)),
    db.select().from(processLpcos).where(eq(processLpcos.processId, id)),
    db.select().from(processEvents).where(eq(processEvents.processId, id)).orderBy(desc(processEvents.eventDate)),
  ]);

  // Itens que vieram da planilha não têm produto ligado: tenta achar a foto
  // pelo SKU (do sistema ou do fabricante) entre os produtos que têm foto.
  const skusWithoutPhoto = [...new Set(items.filter((i) => !i.photoUrl && i.sku).map((i) => i.sku as string))];
  const photoBySku = new Map<string, string>();
  if (skusWithoutPhoto.length > 0) {
    const candidates = await db
      .select({ sku: products.sku, manufacturerSku: products.manufacturerSku, photoUrl: products.photoUrl })
      .from(products)
      .where(
        and(
          isNotNull(products.photoUrl),
          or(inArray(products.sku, skusWithoutPhoto), inArray(products.manufacturerSku, skusWithoutPhoto)),
        ),
      );
    for (const c of candidates) {
      if (c.photoUrl) {
        photoBySku.set(c.sku.toLowerCase(), c.photoUrl);
        if (c.manufacturerSku) photoBySku.set(c.manufacturerSku.toLowerCase(), c.photoUrl);
      }
    }
  }
  const photoOf = (item: (typeof items)[number]) => item.photoUrl ?? (item.sku ? photoBySku.get(item.sku.toLowerCase()) : null) ?? null;

  const invoiceNumberById = new Map(invoices.map((i) => [i.id, i.invoiceNumber]));
  const totalQty = items.reduce((sum, i) => sum + Number(i.quantity ?? 0), 0);
  const invoicesSum = invoices.reduce((sum, i) => sum + Number(i.value ?? 0), 0);
  const stepName = WORKFLOW_STEPS[Math.min(p.currentStep, WORKFLOW_STEPS.length) - 1];
  const hasFinancials = p.internationalFreightValue || p.insuranceValue || p.exchangeRate || invoicesSum > 0;

  return (
    <div className="min-h-screen bg-white p-12 max-w-[900px] mx-auto" style={{ color: INK, fontFamily: "var(--font-app)" }}>
      <PrintButton />

      <div className="h-1.5 -mx-12 -mt-12 mb-10 print:mb-8" style={{ background: ACCENT }} />

      <div className="flex justify-between items-start pb-6 mb-6 border-b" style={{ borderColor: LINE }}>
        <div className="flex items-center gap-4">
          {p.supplierLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- doc estático de impressão, sem necessidade de otimização do next/image
            <img
              src={p.supplierLogoUrl}
              alt={`Logo ${p.supplierName}`}
              className="h-12 max-w-[120px] rounded object-contain"
            />
          )}
          <div>
            <h1 className="text-[24px] font-bold tracking-tight leading-none">RESUMO DO PROCESSO</h1>
            <p className="text-lg font-semibold mt-1.5" style={{ color: ACCENT, fontVariantNumeric: "tabular-nums" }}>
              {p.processNumber}
            </p>
          </div>
        </div>
        <div className="text-right text-xs space-y-0.5" style={{ color: MUTED }}>
          <p>
            Status: <strong style={{ color: INK }}>{STATUS_LABEL[p.status as ProcessStatus]}</strong>
          </p>
          <p>
            Etapa {Math.min(p.currentStep, WORKFLOW_STEPS.length)} de {WORKFLOW_STEPS.length}: {stepName}
          </p>
          <p>Emitido em {new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
        </div>
      </div>

      <section className="mb-6">
        <SectionTitle>Dados do processo</SectionTitle>
        <div className="grid grid-cols-4 gap-x-6 gap-y-3">
          <Field label="Fornecedor" value={p.supplierName} />
          <Field label="Agente de carga" value={p.agentName} />
          <Field label="Modalidade" value={modalidadeLabel(p.modal)} />
          <Field label="Tipo de embarque" value={tipoEmbarqueLabel(p.modal, p.containerType)} />
          <Field label="ETD" value={formatDate(p.etd)} />
          <Field label="ETA estimado" value={formatDate(p.etaEstimated)} />
          <Field label="ETA real" value={formatDate(p.etaActual)} />
          <Field label="Fechamento" value={formatDate(p.closedAt)} />
          <Field label="Local de desembarque" value={landingLabel(p) === "—" ? null : landingLabel(p)} />
          <Field label="Filial de destino" value={p.destinationBranch ? branchLabel(p.destinationBranch) : null} />
          <Field label="Peso" value={p.weightKg ? `${p.weightKg} kg` : null} />
          <Field label="Volume" value={p.volumeM3 ? `${p.volumeM3} m³` : null} />
          <Field label="Referência do agente" value={p.externalReference} />
          <Field label="Nº de rastreio (B/L, AWB)" value={p.trackingNumber} />
          <Field label="Nº DUIMP / DI" value={p.customsDeclarationNumber} />
          <Field
            label="Canal de parametrização"
            value={p.customsChannel ? CUSTOMS_CHANNEL_LABEL[p.customsChannel as CustomsChannel] : null}
          />
          {p.vesselName && <Field label="Navio" value={p.vesselName} />}
        </div>
      </section>

      {invoices.length > 0 && (
        <section className="mb-6">
          <SectionTitle>Invoices</SectionTitle>
          <table data-no-zebra className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b-2" style={{ borderColor: INK }}>
                <Th>Invoice</Th>
                <Th>Fornecedor</Th>
                <Th right>Valor{p.currency ? ` (${p.currency})` : ""}</Th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b" style={{ borderColor: LINE }}>
                  <td className="py-2 pr-3 font-medium">{inv.invoiceNumber}</td>
                  <td className="py-2 pr-3">{inv.supplierName ?? p.supplierName}</td>
                  <td className="py-2 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {money(inv.value, p.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mb-6">
        <SectionTitle>Itens ({items.length})</SectionTitle>
        {items.length === 0 ? (
          <p className="text-sm" style={{ color: MUTED }}>
            Nenhum item registrado.
          </p>
        ) : (
          <table data-no-zebra className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b-2" style={{ borderColor: INK }}>
                <Th>#</Th>
                <Th>Foto</Th>
                <Th>SKU</Th>
                <Th>Descrição</Th>
                <Th>Invoice</Th>
                <Th right>Qtd</Th>
                <Th right>Valor unit.</Th>
                <Th>Cob. cambial</Th>
                <Th>LPCO cons. pública</Th>
                <Th>LPCO</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="border-b align-top" style={{ borderColor: LINE, breakInside: "avoid" }}>
                  <td className="py-2 pr-3" style={{ color: MUTED }}>
                    {idx + 1}
                  </td>
                  <td className="py-2 pr-3">
                    {photoOf(item) ? (
                      // eslint-disable-next-line @next/next/no-img-element -- documento impresso: <img> simples, sem otimização
                      <img
                        src={photoOf(item) as string}
                        alt={item.description}
                        style={{ width: 56, height: 56, objectFit: "contain", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4 }}
                      />
                    ) : (
                      <span style={{ color: MUTED }}>—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {item.sku ?? "—"}
                  </td>
                  <td className="py-2 pr-3 font-medium">{item.description}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {item.invoiceId ? (invoiceNumberById.get(item.invoiceId) ?? "—") : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {item.quantity ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {money(item.unitValueOverride, p.currency)}
                  </td>
                  <td className="py-2 pr-3">{yesNo(item.exchangeCoverage)}</td>
                  <td className="py-2 pr-3">{yesNo(item.lpcoPublicConsultation)}</td>
                  <td className="py-2 whitespace-nowrap">{item.lpcoNumber ?? "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2" style={{ borderColor: INK }}>
                <td colSpan={5} className="pt-2 pr-3 text-right font-bold">
                  Total de peças
                </td>
                <td className="pt-2 pr-3 text-right font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {totalQty}
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      {lpcos.length > 0 && (
        <section className="mb-6">
          <SectionTitle>LPCOs do processo</SectionTitle>
          <table data-no-zebra className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b-2" style={{ borderColor: INK }}>
                <Th>Órgão</Th>
                <Th>Nº</Th>
                <Th>Status</Th>
                <Th>Validade</Th>
              </tr>
            </thead>
            <tbody>
              {lpcos.map((l) => (
                <tr key={l.id} className="border-b" style={{ borderColor: LINE }}>
                  <td className="py-2 pr-3 font-medium">{l.agency}</td>
                  <td className="py-2 pr-3">{l.lpcoNumber ?? "—"}</td>
                  <td className="py-2 pr-3">{LICENSE_STATUS_LABEL[l.status as LicenseStatus]}</td>
                  <td className="py-2">{formatDate(l.validUntil)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {hasFinancials && (
        <section className="mb-6">
          <SectionTitle>Financeiro</SectionTitle>
          <div className="grid grid-cols-4 gap-x-6 gap-y-3">
            <Field label="Incoterm" value={p.incoterm} />
            <Field label="Moeda" value={p.currency} />
            <Field label="Total das invoices" value={invoicesSum > 0 ? money(invoicesSum, p.currency) : null} />
            <Field label="Câmbio (PTAX)" value={p.exchangeRate ? String(p.exchangeRate) : null} />
            <Field label="Frete internacional" value={p.internationalFreightValue ? money(p.internationalFreightValue, p.currency) : null} />
            <Field label="Seguro" value={p.insuranceValue ? money(p.insuranceValue, p.currency) : null} />
          </div>
        </section>
      )}

      {events.length > 0 && (
        <section className="mb-6 break-inside-avoid">
          <SectionTitle>Histórico e follow-up</SectionTitle>
          <table data-no-zebra className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b-2" style={{ borderColor: INK }}>
                <Th>Data</Th>
                <Th>Evento</Th>
                <Th>Origem</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => {
                const isManual = ev.origin?.startsWith("Manual") ?? false;
                return (
                  <tr key={ev.id} className="border-b" style={{ borderColor: LINE }}>
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {isManual
                        ? new Date(ev.eventDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })
                        : new Date(ev.eventDate).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </td>
                    <td className="py-1.5 pr-3 font-medium">{ev.eventType}</td>
                    <td className="py-1.5 pr-3">{ev.origin ?? "—"}</td>
                    <td className="py-1.5">{ev.statusAtEvent ? STATUS_LABEL[ev.statusAtEvent as ProcessStatus] : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {p.notes && (
        <section className="mb-6 break-inside-avoid">
          <SectionTitle>Observações</SectionTitle>
          <p className="text-sm whitespace-pre-wrap">{p.notes}</p>
        </section>
      )}
    </div>
  );
}
