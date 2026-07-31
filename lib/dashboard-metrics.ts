import { db } from "@/db/client";
import {
  processes,
  suppliers,
  freightAgents,
  processItems,
  processDocuments,
  processEvents,
  processInvoices,
  processLpcos,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  STATUS_BY_STEP,
  WORKFLOW_STEPS,
  diasRestantes,
  CUSTOMS_CHANNEL_LABEL,
  LPCO_AGENCY_LABEL,
  type ProcessStatus,
  type CustomsChannel,
} from "@/lib/status";
import type { KpiTrend } from "@/components/dashboard/KpiCard";
import type { AlertLevel } from "@/components/shared/PriorityBadge";

const DAY_MS = 86_400_000;
const DOC_TYPES_PER_PROCESS = 3; // INVOICE, BL, PACKING_LIST — ver process_documents

function utcMidnight(d: Date) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function countInRange(dates: Date[], fromMs: number, toMs: number) {
  return dates.filter((d) => {
    const t = d.getTime();
    return t >= fromMs && t < toMs;
  }).length;
}

function dailySeries(dates: Date[], days: number) {
  const todayUtc = utcMidnight(new Date());
  const buckets = new Array(days).fill(0);
  for (const d of dates) {
    const diffDays = Math.round((todayUtc - utcMidnight(d)) / DAY_MS);
    const idx = days - 1 - diffDays;
    if (idx >= 0 && idx < days) buckets[idx] += 1;
  }
  return buckets;
}

function buildTrend(dates: Date[], { invert = false }: { invert?: boolean } = {}): KpiTrend {
  const now = Date.now();
  const last7 = countInRange(dates, now - 7 * DAY_MS, now);
  const prev7 = countInRange(dates, now - 14 * DAY_MS, now - 7 * DAY_MS);

  if (last7 === prev7) return { value: 0, direction: "flat" };

  const pct = prev7 === 0 ? 100 : Math.round(((last7 - prev7) / prev7) * 100);
  const rawDirection = last7 > prev7 ? "up" : "down";
  const direction = invert ? (rawDirection === "up" ? "down" : "up") : rawDirection;
  return { value: Math.abs(pct), direction, positive: direction === "up" ? !invert : invert };
}

export async function getDashboardMetrics() {
  const [processRows, itemRows, docRows, eventRows, invoiceRows, lpcoRows] = await Promise.all([
    db
      .select({
        id: processes.id,
        processNumber: processes.processNumber,
        status: processes.status,
        modal: processes.modal,
        currentStep: processes.currentStep,
        etd: processes.etd,
        etaEstimated: processes.etaEstimated,
        destination: processes.destination,
        destinationCity: processes.destinationCity,
        destinationState: processes.destinationState,
        createdAt: processes.createdAt,
        supplierName: suppliers.name,
        supplierLogoUrl: suppliers.logoUrl,
        agentName: freightAgents.name,
        internationalFreightValue: processes.internationalFreightValue,
        insuranceValue: processes.insuranceValue,
        exchangeRate: processes.exchangeRate,
        customsChannel: processes.customsChannel,
      })
      .from(processes)
      .innerJoin(suppliers, eq(processes.supplierId, suppliers.id))
      .leftJoin(freightAgents, eq(processes.agentId, freightAgents.id)),
    db
      .select({
        processId: processItems.processId,
        quantity: processItems.quantity,
        createdAt: processItems.createdAt,
      })
      .from(processItems),
    db
      .select({
        processId: processDocuments.processId,
        status: processDocuments.status,
        uploadedAt: processDocuments.uploadedAt,
      })
      .from(processDocuments),
    db
      .select({
        processId: processEvents.processId,
        eventDate: processEvents.eventDate,
        statusAtEvent: processEvents.statusAtEvent,
      })
      .from(processEvents)
      .orderBy(processEvents.eventDate),
    db
      .select({
        processId: processInvoices.processId,
        value: processInvoices.value,
      })
      .from(processInvoices),
    db
      .select({
        processId: processLpcos.processId,
        agency: processLpcos.agency,
        validUntil: processLpcos.validUntil,
      })
      .from(processLpcos),
  ]);

  const ativos = processRows.filter((p) => p.status !== "CONCLUIDO");
  const emTransito = processRows.filter((p) => p.status === "EM_TRANSITO");
  const finalizados = processRows.filter((p) => p.status === "CONCLUIDO");
  const atrasados = processRows.filter((p) => p.status === "ATRASADO");

  const ativoIds = new Set(ativos.map((p) => p.id));
  const itensAtivos = itemRows.filter((i) => ativoIds.has(i.processId));
  const totalItensAtivos = itensAtivos.reduce((sum, i) => sum + Number(i.quantity ?? 0), 0);

  const uploadedByProcess = new Map<string, number>();
  for (const doc of docRows) {
    if (doc.status === "UPLOADED") {
      uploadedByProcess.set(doc.processId, (uploadedByProcess.get(doc.processId) ?? 0) + 1);
    }
  }
  const documentosPendentes = ativos.reduce((sum, p) => {
    const uploaded = uploadedByProcess.get(p.id) ?? 0;
    return sum + Math.max(0, DOC_TYPES_PER_PROCESS - uploaded);
  }, 0);

  // --- Valor FOB/CIF (só processos com câmbio + ao menos 1 invoice com
  // valor preenchidos — a maioria dos processos existentes não tem esse
  // dado ainda, e são simplesmente omitidos da soma em vez de contar como 0) ---
  const invoiceValueByProcess = new Map<string, number>();
  for (const inv of invoiceRows) {
    if (inv.value === null) continue;
    invoiceValueByProcess.set(inv.processId, (invoiceValueByProcess.get(inv.processId) ?? 0) + Number(inv.value));
  }
  let fobTotalBRL = 0;
  let cifTotalBRL = 0;
  const financialCompleteDates: Date[] = [];
  for (const p of ativos) {
    const invoicesSum = invoiceValueByProcess.get(p.id);
    const rate = p.exchangeRate ? Number(p.exchangeRate) : null;
    if (invoicesSum === undefined || rate === null) continue;
    const freight = p.internationalFreightValue ? Number(p.internationalFreightValue) : 0;
    const insurance = p.insuranceValue ? Number(p.insuranceValue) : 0;
    fobTotalBRL += invoicesSum * rate;
    cifTotalBRL += (invoicesSum + freight + insurance) * rate;
    financialCompleteDates.push(new Date(p.createdAt));
  }

  // --- KPIs (número + trend + sparkline, tudo derivado de timestamps reais) ---
  const createdDates = processRows.map((p) => new Date(p.createdAt));
  const transitoDates = eventRows.filter((e) => e.statusAtEvent === "EM_TRANSITO").map((e) => new Date(e.eventDate));
  const finalizadoDates = eventRows.filter((e) => e.statusAtEvent === "CONCLUIDO").map((e) => new Date(e.eventDate));
  const atrasadoDates = eventRows.filter((e) => e.statusAtEvent === "ATRASADO").map((e) => new Date(e.eventDate));
  const uploadDates = docRows.filter((d) => d.uploadedAt).map((d) => new Date(d.uploadedAt as unknown as string));
  const itemDates = itensAtivos.map((i) => new Date(i.createdAt));

  const kpis = {
    processosAtivos: {
      value: ativos.length,
      trend: buildTrend(createdDates),
      sparkline: dailySeries(createdDates, 14),
    },
    emTransito: {
      value: emTransito.length,
      trend: buildTrend(transitoDates),
      sparkline: dailySeries(transitoDates, 14),
    },
    finalizados: {
      value: finalizados.length,
      trend: buildTrend(finalizadoDates),
      sparkline: dailySeries(finalizadoDates, 14),
    },
    atrasados: {
      value: atrasados.length,
      trend: buildTrend(atrasadoDates, { invert: true }),
      sparkline: dailySeries(atrasadoDates, 14),
    },
    documentosPendentes: {
      value: documentosPendentes,
      trend: buildTrend(uploadDates),
      sparkline: dailySeries(uploadDates, 14),
    },
    itensEmProcesso: {
      value: totalItensAtivos,
      trend: buildTrend(itemDates),
      sparkline: dailySeries(itemDates, 14),
    },
    valorFobTotal: {
      value: fobTotalBRL,
      trend: buildTrend(financialCompleteDates),
      sparkline: dailySeries(financialCompleteDates, 14),
    },
    valorCifTotal: {
      value: cifTotalBRL,
      trend: buildTrend(financialCompleteDates),
      sparkline: dailySeries(financialCompleteDates, 14),
    },
  };

  // --- Importações por mês (últimos 6 meses, por ETD com fallback createdAt) ---
  const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({
      key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`,
      label: monthFormatter.format(d).replace(".", ""),
    });
  }
  const importsByMonth = months.map(({ key, label }) => {
    const count = processRows.filter((p) => {
      const raw = p.etd ?? p.createdAt;
      const d = new Date(raw as unknown as string);
      return `${d.getUTCFullYear()}-${d.getUTCMonth()}` === key;
    }).length;
    return { label, value: count };
  });

  // --- Alertas prioritários (atrasados, ETA <= 3 dias, ou LPCO vencendo/vencida) ---
  const etaAlertCandidates = ativos
    .map((p) => {
      const dias = diasRestantes(p.etaEstimated);
      const isAtrasado = p.status === "ATRASADO";
      const isUrgente = dias !== null && dias <= 3;
      return { p, dias, isAtrasado, isUrgente };
    })
    .filter((a) => a.isAtrasado || a.isUrgente)
    .map(({ p, dias, isAtrasado }) => {
      const level: AlertLevel = isAtrasado ? "critical" : (dias ?? 0) < 0 ? "critical" : "warning";
      return {
        id: p.id,
        level,
        dias: dias ?? 0,
        title: `${p.processNumber} — ${p.supplierName}`,
        description: dias !== null && dias < 0 ? `ETA vencida` : `ETA em ${dias} dia(s)`,
        responsible: p.agentName ?? undefined,
        daysOverdue: dias !== null && dias < 0 ? Math.abs(dias) : undefined,
        href: `/processos/${p.id}`,
      };
    });

  const processById = new Map(processRows.map((p) => [p.id, p]));
  const lpcoAlertCandidates = lpcoRows
    .filter((l) => l.validUntil)
    .map((l) => {
      const process = processById.get(l.processId);
      const dias = diasRestantes(l.validUntil);
      return { l, process, dias };
    })
    .filter(
      (a): a is typeof a & { process: NonNullable<typeof a.process>; dias: number } =>
        Boolean(a.process) && a.dias !== null && a.dias <= 15,
    )
    .map(({ l, process, dias }) => {
      const level: AlertLevel = dias < 0 ? "critical" : "warning";
      const agencyLabel = LPCO_AGENCY_LABEL[l.agency];
      return {
        id: `lpco-${l.processId}-${l.agency}-${l.validUntil}`,
        level,
        dias,
        title: `${process.processNumber} — LPCO ${agencyLabel}`,
        description: dias < 0 ? "LPCO vencida" : `LPCO vence em ${dias} dia(s)`,
        responsible: process.agentName ?? undefined,
        daysOverdue: dias < 0 ? Math.abs(dias) : undefined,
        href: `/processos/${l.processId}`,
      };
    });

  const alerts = [...etaAlertCandidates, ...lpcoAlertCandidates]
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 6)
    .map(({ dias: _dias, ...alert }) => alert);

  // --- Distribuição por canal de parametrização (só processos com canal definido) ---
  const CHANNEL_ORDER: CustomsChannel[] = ["VERDE", "AMARELO", "VERMELHO", "CINZA"];
  const channelCounts = new Map<CustomsChannel, number>();
  for (const p of ativos) {
    if (!p.customsChannel) continue;
    channelCounts.set(p.customsChannel, (channelCounts.get(p.customsChannel) ?? 0) + 1);
  }
  const byCustomsChannel = CHANNEL_ORDER.filter((c) => channelCounts.has(c)).map((c) => ({
    label: CUSTOMS_CHANNEL_LABEL[c],
    value: channelCounts.get(c)!,
  }));

  // --- Processos por Destino (substitui o mapa mundial — dado real) ---
  const destinationCounts = new Map<string, number>();
  for (const p of ativos) {
    const label = p.destinationCity
      ? `${p.destinationCity}${p.destinationState ? `/${p.destinationState}` : ""}`
      : (p.destination ?? "Não informado");
    destinationCounts.set(label, (destinationCounts.get(label) ?? 0) + 1);
  }
  const byDestination = Array.from(destinationCounts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // --- Pipeline logístico (8 etapas + tempo médio real via process_events) ---
  const durationsByStatus = new Map<ProcessStatus, number[]>();
  const eventsByProcess = new Map<string, typeof eventRows>();
  for (const e of eventRows) {
    if (!e.statusAtEvent) continue;
    const list = eventsByProcess.get(e.processId) ?? [];
    list.push(e);
    eventsByProcess.set(e.processId, list);
  }
  for (const list of eventsByProcess.values()) {
    for (let i = 0; i < list.length - 1; i++) {
      const current = list[i];
      const next = list[i + 1];
      if (!current.statusAtEvent) continue;
      const durationDays = (new Date(next.eventDate).getTime() - new Date(current.eventDate).getTime()) / DAY_MS;
      const arr = durationsByStatus.get(current.statusAtEvent) ?? [];
      arr.push(durationDays);
      durationsByStatus.set(current.statusAtEvent, arr);
    }
  }

  const stepCounts = new Map<number, number>();
  for (const p of ativos) {
    stepCounts.set(p.currentStep, (stepCounts.get(p.currentStep) ?? 0) + 1);
  }
  const totalAtivos = Math.max(1, ativos.length);
  const pipeline = WORKFLOW_STEPS.map((label, idx) => {
    const step = idx + 1;
    const count = stepCounts.get(step) ?? 0;
    const status = STATUS_BY_STEP[step];
    const durations = status ? durationsByStatus.get(status) : undefined;
    const avgDays = durations && durations.length ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : null;
    return {
      label,
      count,
      percentage: Math.round((count / totalAtivos) * 100),
      avgDays,
    };
  });

  // --- Tabela de processos (dados reais, sem "Cliente"/valores FOB/CIF) ---
  const table = processRows
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((p) => ({
      id: p.id,
      processNumber: p.processNumber,
      supplierName: p.supplierName,
      supplierLogoUrl: p.supplierLogoUrl,
      modal: p.modal,
      destination: p.destinationCity
        ? `${p.destinationCity}${p.destinationState ? `/${p.destinationState}` : ""}`
        : (p.destination ?? "—"),
      etaEstimated: p.etaEstimated,
      status: p.status,
      agentName: p.agentName,
    }));

  return { kpis, importsByMonth, alerts, byDestination, byCustomsChannel, pipeline, table };
}

export type DashboardMetrics = Awaited<ReturnType<typeof getDashboardMetrics>>;
