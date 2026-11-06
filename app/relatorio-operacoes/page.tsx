import PrintButton from "@/components/PrintButton";
import { getDashboardMetrics } from "@/lib/dashboard-metrics";
import { modalidadeLabel } from "@/lib/modais";
import { STATUS_LABEL, formatDate, type ProcessStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

// Cores fixas (não usam os tokens de tema do app): o relatório é impresso /
// salvo em PDF e precisa sair sempre igual — mesmo padrão do processo impresso.
const INK = "#0f172a";
const ACCENT = "#2abf9c";
const MUTED = "#64748b";
const LINE = "#d8e0e9";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function money(value: number | null, currency: string | null) {
  if (value === null) return "—";
  if (currency && currency !== "OTHER") {
    try {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
    } catch {
      // código de moeda desconhecido pro Intl: cai no número simples
    }
  }
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-3 border-b pb-1.5 text-xs font-bold uppercase tracking-wider"
      style={{ color: ACCENT, borderColor: LINE }}
    >
      {children}
    </h2>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="py-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
      {children}
    </th>
  );
}

export default async function RelatorioOperacoesPage() {
  const metrics = await getDashboardMetrics();
  const k = metrics.kpis;
  const emitido = new Date().toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });

  const kpis: [string, string][] = [
    ["Pedidos em aberto", String(k.pedidosAbertos.value)],
    ["Processos ativos", String(k.processosAtivos.value)],
    ["Em trânsito", String(k.emTransito.value)],
    ["Atrasados", String(k.atrasados.value)],
    ["Finalizados", String(k.finalizados.value)],
    ["Documentos pendentes", String(k.documentosPendentes.value)],
    ["Itens em processo", String(k.itensEmProcesso.value)],
    ["Valor FOB total", brl.format(k.valorFobTotal.value)],
    ["Valor CIF total", brl.format(k.valorCifTotal.value)],
  ];

  return (
    <div className="mx-auto min-h-screen max-w-[900px] bg-white p-12" style={{ color: INK, fontFamily: "var(--font-app)" }}>
      <PrintButton />

      <div className="-mx-12 -mt-12 mb-10 h-1.5 print:mb-8" style={{ background: ACCENT }} />

      <div className="mb-6 flex items-start justify-between border-b pb-6" style={{ borderColor: LINE }}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
            ImportFlow TMS · Logística Global &amp; Alfândega
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Relatório de Operações</h1>
          <p className="mt-1 text-sm" style={{ color: MUTED }}>
            Resumo do Dashboard — processos de importação em andamento
          </p>
        </div>
        <p className="text-right text-xs" style={{ color: MUTED }}>
          Emitido em
          <br />
          <span className="font-medium" style={{ color: INK }}>
            {emitido}
          </span>
        </p>
      </div>

      <section className="mb-8">
        <SectionTitle>Indicadores</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          {kpis.map(([label, value]) => (
            <div key={label} className="rounded-lg border px-4 py-3" style={{ borderColor: LINE }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                {label}
              </p>
              <p className="mt-1 text-xl font-bold">{value}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px]" style={{ color: MUTED }}>
          Valores FOB/CIF somam apenas os processos com invoice com valor e câmbio preenchidos.
        </p>
      </section>

      <section className="mb-8">
        <SectionTitle>Etapas do fluxo</SectionTitle>
        <table data-no-zebra className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: LINE }}>
              <Th>Etapa</Th>
              <Th>Processos</Th>
              <Th>% dos ativos</Th>
              <Th>Tempo médio na etapa</Th>
            </tr>
          </thead>
          <tbody>
            {metrics.pipeline.map((s) => (
              <tr key={s.label} className="border-b" style={{ borderColor: LINE }}>
                <td className="py-1.5 pr-3 font-medium">{s.label}</td>
                <td className="py-1.5 pr-3">{s.count}</td>
                <td className="py-1.5 pr-3">{s.percentage}%</td>
                <td className="py-1.5 pr-3">{s.avgDays === null || s.avgDays === undefined ? "—" : `${s.avgDays} dia(s)`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {metrics.alerts.length > 0 && (
        <section className="mb-8">
          <SectionTitle>Alertas prioritários</SectionTitle>
          <ul className="space-y-1.5 text-sm">
            {metrics.alerts.map((a) => (
              <li key={a.id} className="flex justify-between gap-4 border-b pb-1.5" style={{ borderColor: LINE }}>
                <span className="font-medium">{a.title}</span>
                <span style={{ color: MUTED }}>
                  {a.description}
                  {a.responsible ? ` · ${a.responsible}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle>Processos em acompanhamento ({metrics.table.length})</SectionTitle>
        {metrics.table.length === 0 ? (
          <p className="text-sm" style={{ color: MUTED }}>
            Nenhum processo em andamento.
          </p>
        ) : (
          <table data-no-zebra className="w-full text-xs">
            <thead>
              <tr className="border-b" style={{ borderColor: LINE }}>
                <Th>Processo</Th>
                <Th>Fornecedor / Origem</Th>
                <Th>Modal</Th>
                <Th>ETA</Th>
                <Th>Valor (FOB)</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {metrics.table.map((r) => (
                <tr key={r.id} className="border-b break-inside-avoid" style={{ borderColor: LINE }}>
                  <td className="py-1.5 pr-3 font-mono font-semibold">{r.processNumber}</td>
                  <td className="py-1.5 pr-3">
                    <span className="font-medium uppercase">{r.supplierName}</span>
                    {r.supplierCountry && <span style={{ color: MUTED }}> · {r.supplierCountry}</span>}
                  </td>
                  <td className="py-1.5 pr-3">{modalidadeLabel(r.modal)}</td>
                  <td className="py-1.5 pr-3 font-mono">{formatDate(r.etaEstimated)}</td>
                  <td className="py-1.5 pr-3 font-mono">{money(r.fobValue, r.currency)}</td>
                  <td className="py-1.5 pr-3">{STATUS_LABEL[r.status as ProcessStatus] ?? r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="mt-10 border-t pt-3 text-[10px]" style={{ borderColor: LINE, color: MUTED }}>
        Gerado automaticamente pelo ImportFlow TMS.
      </p>
    </div>
  );
}
