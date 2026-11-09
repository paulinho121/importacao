import { notFound } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  freightAgents,
  processFreightQuoteLines,
  processFreightQuotes,
  processes,
  suppliers,
} from "@/db/schema";
import PrintButton from "@/components/PrintButton";
import { MODALIDADES } from "@/lib/modais";
import {
  QUOTE_STATUSES,
  formatMoney,
  totalBRL,
  totalInForeign,
  totalsByCurrency,
  transitLabel,
  type QuoteSection,
} from "@/lib/freight-quotes";
import { formatDate } from "@/lib/status";
import { driveDownloadUrl } from "@/lib/drive-links";

export const dynamic = "force-dynamic";

// Cores fixas (não usam os tokens de tema do app): o relatório é impresso /
// salvo em PDF e precisa sair sempre igual — mesmo padrão do processo impresso.
const INK = "#0f172a";
const ACCENT = "#2abf9c";
const MUTED = "#64748b";
const LINE = "#d8e0e9";
const COLORS = ["#1f9d8f", "#2b7bbf", "#7b5ea7", "#d99a14", "#d9534f", "#c026d3"];
const GREEN = "#22c55e";

const money = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Line = typeof processFreightQuoteLines.$inferSelect;

export default async function CotacoesImprimirPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [p] = await db
    .select({
      processNumber: processes.processNumber,
      currency: processes.currency,
      exchangeRate: processes.exchangeRate,
      supplierName: suppliers.name,
    })
    .from(processes)
    .innerJoin(suppliers, eq(processes.supplierId, suppliers.id))
    .where(eq(processes.id, id));
  if (!p) notFound();

  const quotes = await db
    .select({ quote: processFreightQuotes, agentName: freightAgents.name })
    .from(processFreightQuotes)
    .leftJoin(freightAgents, eq(processFreightQuotes.agentId, freightAgents.id))
    .where(eq(processFreightQuotes.processId, id))
    .orderBy(asc(processFreightQuotes.createdAt));

  const quoteIds = quotes.map((q) => q.quote.id);
  const lineRows = quoteIds.length
    ? await db
        .select()
        .from(processFreightQuoteLines)
        .where(inArray(processFreightQuoteLines.quoteId, quoteIds))
        .orderBy(asc(processFreightQuoteLines.position))
    : [];
  const linesOf = (quoteId: string): Line[] => lineRows.filter((l) => l.quoteId === quoteId);

  // Moeda estrangeira da comparação e câmbio do processo (se houver).
  const foreign = p.currency && p.currency !== "BRL" && p.currency !== "OTHER" ? p.currency : "USD";
  const rate = p.exchangeRate && foreign === p.currency ? Number(p.exchangeRate) : null;

  const cols = quotes.map(({ quote, agentName }, i) => {
    const lines = linesOf(quote.id);
    return {
      quote,
      agentName: agentName ?? "Agente",
      color: COLORS[i % COLORS.length],
      lines,
      totals: totalsByCurrency(lines),
      inForeign: lines.length > 0 ? totalInForeign(lines, foreign, rate) : null,
      inBRL: lines.length > 0 ? totalBRL(lines, foreign, rate) : null,
    };
  });

  // Menor custo: em reais quando todas convertem; senão, valores brutos se todas
  // estiverem numa única e mesma moeda (mesma regra da tela).
  const withLines = cols.filter((c) => c.lines.length > 0);
  let keys: (number | null)[] = cols.map(() => null);
  if (withLines.length >= 2 && withLines.every((c) => c.inBRL !== null)) {
    keys = cols.map((c) => (c.lines.length > 0 ? c.inBRL : null));
  } else if (
    withLines.length >= 2 &&
    withLines.every((c) => c.totals.length === 1) &&
    new Set(withLines.map((c) => c.totals[0].currency)).size === 1
  ) {
    keys = cols.map((c) => (c.lines.length > 0 ? c.totals[0].value : null));
  }
  const keyed = keys.filter((v): v is number => v !== null);
  const cheapest = keyed.length >= 2 ? Math.min(...keyed) : null;
  const isCheapest = (i: number) => cheapest !== null && keys[i] === cheapest;
  const isFechada = (i: number) => cols[i].quote.status === "FECHADO";

  const sectionCell = (lines: Line[], section: QuoteSection) => {
    const own = lines.filter((l) => l.section === section);
    if (own.length === 0) return <span style={{ color: MUTED }}>—</span>;
    return (
      <>
        <p className="font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
          {totalsByCurrency(own)
            .map((t) => `${t.currency} ${money(t.value)}`)
            .join(" + ")}
        </p>
        {own.map((l) => (
          <p key={l.id} className="text-[9px] leading-tight" style={{ color: MUTED }}>
            {l.description}: {l.currency} {money(Number(l.total))}
          </p>
        ))}
      </>
    );
  };

  type Row = { label: string; cell: (i: number) => React.ReactNode; strong?: boolean };
  const text = (v: string | null | undefined) => (v ? v : <span style={{ color: MUTED }}>—</span>);
  const rows: { group: string; items: Row[] }[] = [
    {
      group: "Dados gerais",
      items: [
        { label: "Situação", cell: (i) => QUOTE_STATUSES.find((s) => s.value === cols[i].quote.status)?.label ?? "—" },
        { label: "Proposta", cell: (i) => text(cols[i].quote.proposal) },
        {
          label: "Modal",
          cell: (i) => text(MODALIDADES.find((m) => m.value === cols[i].quote.modalidade)?.label),
        },
        { label: "Tipo", cell: (i) => text(cols[i].quote.containerType) },
        { label: "Incoterm", cell: (i) => text(cols[i].quote.incoterm?.split(" - ")[0]) },
      ],
    },
    {
      group: "Rota e prazos",
      items: [
        {
          label: "Trânsito",
          cell: (i) => transitLabel(cols[i].quote.transitDays, cols[i].quote.transitDaysMax),
        },
        { label: "Origem", cell: (i) => text(cols[i].quote.origin) },
        { label: "Destino", cell: (i) => text(cols[i].quote.destination) },
        { label: "Cia", cell: (i) => text(cols[i].quote.carrier) },
        { label: "Validade", cell: (i) => text(cols[i].quote.validUntil ? formatDate(cols[i].quote.validUntil) : null) },
      ],
    },
    {
      group: "Carga e frete",
      items: [
        {
          label: "Peso considerado",
          cell: (i) => text(cols[i].quote.grossWeightKg ? `${Number(cols[i].quote.grossWeightKg)} kg` : null),
        },
        {
          label: "Frete",
          cell: (i) => {
            const f = cols[i].lines.find((l) => l.section === "FRETE");
            if (!f) return text(null);
            return (
              <>
                <p className="font-bold">
                  {f.currency} {money(Number(f.total))}
                </p>
                {f.unitPrice && f.quantity && (
                  <p className="text-[9px]" style={{ color: MUTED }}>
                    {Number(f.quantity)} kg × {Number(f.unitPrice)}
                  </p>
                )}
              </>
            );
          },
        },
      ],
    },
    {
      group: "Taxas",
      items: [
        { label: "TX origem", cell: (i) => sectionCell(cols[i].lines, "ORIGEM") },
        { label: "TX destino", cell: (i) => sectionCell(cols[i].lines, "DESTINO") },
        { label: "DTA e outros", cell: (i) => sectionCell(cols[i].lines, "OUTRAS") },
      ],
    },
  ];

  const colCount = cols.length;
  const selected = cols.find((c) => c.quote.isSelected);

  return (
    <div
      className="min-h-screen bg-white p-10 max-w-[1150px] mx-auto print:p-0 print:max-w-none"
      style={{ color: INK, fontFamily: "var(--font-app)" }}
    >
      <style>{"@page { size: A4 landscape; margin: 10mm; }"}</style>
      <PrintButton />

      <div className="h-1.5 -mx-10 -mt-10 mb-8 print:mx-0 print:mt-0 print:mb-5" style={{ background: ACCENT }} />

      <div className="flex justify-between items-start pb-5 mb-5 border-b" style={{ borderColor: LINE }}>
        <div>
          <h1 className="text-[22px] font-bold tracking-tight leading-none">COMPARATIVO DE COTAÇÕES DE FRETE</h1>
          <p className="text-lg font-semibold mt-1.5" style={{ color: ACCENT, fontVariantNumeric: "tabular-nums" }}>
            {p.processNumber}
          </p>
        </div>
        <div className="text-right text-xs space-y-0.5" style={{ color: MUTED }}>
          <p>
            Fornecedor: <strong style={{ color: INK }}>{p.supplierName}</strong>
          </p>
          <p>
            Câmbio para comparar:{" "}
            <strong style={{ color: INK }}>{rate ? `${foreign} 1 = R$ ${money(rate)}` : "não informado"}</strong>
          </p>
          <p>Emitido em {new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
        </div>
      </div>

      {colCount === 0 ? (
        <p className="text-sm" style={{ color: MUTED }}>
          Este processo ainda não tem cotações de frete.
        </p>
      ) : (
        <>
          <table data-no-zebra className="w-full border-collapse text-[11px]" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 150 }} />
              {cols.map((c) => (
                <col key={c.quote.id} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="py-2 pr-2 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                  Agente de cargas
                </th>
                {cols.map((c, i) => (
                  <th
                    key={c.quote.id}
                    className="px-2 py-2 text-center text-xs font-bold uppercase text-white"
                    style={{
                      background: c.color,
                      boxShadow: isFechada(i) ? `inset 0 0 0 3px ${GREEN}` : undefined,
                    }}
                  >
                    {c.agentName}
                    {isFechada(i) && (
                      <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px]" style={{ background: GREEN, color: "#000" }}>
                        FECHADA
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <GroupRows key={g.group} title={g.group} colCount={colCount}>
                  {g.items.map((r) => (
                    <tr key={r.label} className="break-inside-avoid">
                      <td className="border-t py-1.5 pr-2 font-bold" style={{ borderColor: LINE }}>
                        {r.label}
                      </td>
                      {cols.map((c, i) => (
                        <td
                          key={c.quote.id}
                          className="border-t border-l px-2 py-1.5 align-top text-center"
                          style={{ borderColor: LINE, background: isFechada(i) ? `${GREEN}22` : `${c.color}12` }}
                        >
                          {r.cell(i)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </GroupRows>
              ))}

              <GroupRows title="Total" colCount={colCount}>
                <tr className="break-inside-avoid">
                  <td className="border-t py-1.5 pr-2 font-bold" style={{ borderColor: LINE }}>
                    Total por moeda
                  </td>
                  {cols.map((c, i) => (
                    <td
                      key={c.quote.id}
                      className="border-t border-l px-2 py-1.5 align-top text-center font-bold"
                      style={{ borderColor: LINE, background: isCheapest(i) ? `${GREEN}55` : `${c.color}12` }}
                    >
                      {c.totals.length === 0 ? (
                        <span style={{ color: MUTED }}>—</span>
                      ) : (
                        c.totals.map((t) => (
                          <p key={t.currency}>
                            {t.currency} {money(t.value)}
                          </p>
                        ))
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="break-inside-avoid">
                  <td className="border-t py-2 pr-2 text-xs font-extrabold" style={{ borderColor: LINE }}>
                    TOTAL {foreign}
                  </td>
                  {cols.map((c, i) => (
                    <td
                      key={c.quote.id}
                      className="border-t border-l px-2 py-2 align-top text-center text-sm font-extrabold"
                      style={{ borderColor: LINE, background: isCheapest(i) ? `${GREEN}55` : `${c.color}12` }}
                    >
                      {isCheapest(i) && (
                        <span className="mb-1 block text-[9px]" style={{ color: "#15803d" }}>
                          ★ MENOR CUSTO
                        </span>
                      )}
                      {c.inForeign !== null ? (
                        `${foreign} ${money(c.inForeign)}`
                      ) : (
                        <span className="text-[10px] font-normal" style={{ color: MUTED }}>
                          {c.totals.length === 0 ? "—" : "sem câmbio"}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="break-inside-avoid">
                  <td className="border-t py-1.5 pr-2 font-bold" style={{ borderColor: LINE }}>
                    Total em reais
                  </td>
                  {cols.map((c, i) => (
                    <td
                      key={c.quote.id}
                      className="border-t border-l px-2 py-1.5 align-top text-center font-bold"
                      style={{ borderColor: LINE, background: isCheapest(i) ? `${GREEN}55` : `${c.color}12` }}
                    >
                      {c.inBRL !== null ? formatMoney(c.inBRL, "BRL") : <span style={{ color: MUTED }}>—</span>}
                    </td>
                  ))}
                </tr>
                <tr className="break-inside-avoid">
                  <td className="border-t py-1.5 pr-2 font-bold" style={{ borderColor: LINE }}>
                    Link (Drive)
                  </td>
                  {cols.map((c) => {
                    const href = driveDownloadUrl(c.quote.driveUrl);
                    return (
                      <td
                        key={c.quote.id}
                        className="border-t border-l px-2 py-1.5 align-top text-center text-[10px]"
                        style={{ borderColor: LINE, background: `${c.color}12` }}
                      >
                        {href ? (
                          <a href={href} style={{ color: "#1d4ed8", textDecoration: "underline" }}>
                            Baixar cotação
                          </a>
                        ) : (
                          <span style={{ color: MUTED }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr className="break-inside-avoid">
                  <td className="border-t py-1.5 pr-2 font-bold" style={{ borderColor: LINE }}>
                    Observação
                  </td>
                  {cols.map((c) => (
                    <td
                      key={c.quote.id}
                      className="border-t border-l px-2 py-1.5 align-top text-center text-[10px]"
                      style={{ borderColor: LINE, background: `${c.color}12` }}
                    >
                      {text(c.quote.notes)}
                    </td>
                  ))}
                </tr>
              </GroupRows>
            </tbody>
          </table>

          <p className="mt-4 text-[10px]" style={{ color: MUTED }}>
            {selected ? (
              <>
                Cotação escolhida: <strong style={{ color: INK }}>{selected.agentName}</strong>.{" "}
              </>
            ) : null}
            Valores estimados, sujeitos a confirmação. O menor custo é calculado em reais quando todas as cotações têm
            câmbio; sem câmbio, só quando todas usam a mesma moeda.
          </p>
        </>
      )}
    </div>
  );
}

// Faixa de título de um grupo de linhas ("Dados gerais", "Taxas"…) seguida das linhas.
function GroupRows({ title, colCount, children }: { title: string; colCount: number; children: React.ReactNode }) {
  return (
    <>
      <tr className="break-inside-avoid">
        <td
          colSpan={colCount + 1}
          className="pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider"
          style={{ color: ACCENT }}
        >
          {title}
        </td>
      </tr>
      {children}
    </>
  );
}
