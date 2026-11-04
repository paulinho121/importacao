import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { purchaseOrderEvents } from "@/db/schema";
import { PO_EVENT_META } from "@/lib/purchase-order-events";

const STEPS = [
  { type: "CRIADO", label: "Criado" },
  { type: "ENVIADO", label: "Enviado" },
  { type: "CONFIRMADO", label: "Confirmado" },
  { type: "PROCESSO_VINCULADO", label: "Em processo" },
] as const;

const fmtDateTime = (d: Date) =>
  d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const fmtDate = (d: Date) =>
  d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" });

// Andamento do pedido (Criado → Enviado → Confirmado → Em processo) e a linha
// do tempo com tudo o que aconteceu nele: edições, itens, status, packing list
// e entrada em processo.
export default async function PurchaseOrderHistory({
  poId,
  status,
  inProcess,
}: {
  poId: string;
  status: string;
  inProcess: boolean;
}) {
  const events = await db
    .select()
    .from(purchaseOrderEvents)
    .where(eq(purchaseOrderEvents.purchaseOrderId, poId))
    .orderBy(desc(purchaseOrderEvents.createdAt));

  // data do primeiro evento de cada etapa (o mais antigo, já que a lista vem do mais novo)
  const stepDate = (type: string) => {
    const found = events.filter((e) => e.eventType === type);
    return found.length > 0 ? found[found.length - 1].createdAt : null;
  };
  const reached: Record<string, boolean> = {
    CRIADO: true,
    ENVIADO: status === "ENVIADO" || status === "CONFIRMADO" || stepDate("ENVIADO") !== null,
    CONFIRMADO: status === "CONFIRMADO" || stepDate("CONFIRMADO") !== null,
    PROCESSO_VINCULADO: inProcess,
  };
  const cancelled = status === "CANCELADO";

  return (
    <section className="bg-surface-container-lowest border border-outline-variant p-gutter rounded-xl shadow-sm">
      <div className="mb-stack-md flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">history</span>
        <h3 className="font-headline-sm text-headline-sm text-primary">Andamento e histórico</h3>
      </div>

      <ol className="mb-4 grid grid-cols-4 gap-1">
        {STEPS.map((step) => {
          const done = reached[step.type];
          const date = stepDate(step.type);
          return (
            <li key={step.type} className="flex flex-col items-center text-center">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  done ? "bg-secondary text-white" : "border border-outline-variant text-on-surface-variant"
                }`}
              >
                {done ? <span className="material-symbols-outlined text-[16px]">check</span> : "·"}
              </span>
              <span className={`mt-1 text-[11px] font-bold leading-tight ${done ? "text-primary" : "text-on-surface-variant"}`}>
                {step.label}
              </span>
              <span className="text-[10px] text-on-surface-variant">{done && date ? fmtDate(date) : "—"}</span>
            </li>
          );
        })}
      </ol>
      {cancelled && (
        <p className="mb-3 rounded-lg bg-error-container px-3 py-2 text-xs font-bold text-on-error-container">
          Pedido cancelado
        </p>
      )}

      {events.length === 0 ? (
        <p className="text-body-sm font-body-sm text-on-surface-variant">Nada registrado ainda.</p>
      ) : (
        <ul className="space-y-3 border-l border-outline-variant pl-4">
          {events.map((e) => {
            const meta = PO_EVENT_META[e.eventType] ?? { label: e.eventType, icon: "circle" };
            return (
              <li key={e.id} className="relative">
                <span className="absolute -left-[26px] top-0 flex h-5 w-5 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
                  <span className="material-symbols-outlined text-[13px]">{meta.icon}</span>
                </span>
                <p className="text-sm font-bold text-primary">{meta.label}</p>
                {e.description && <p className="break-words text-xs text-on-surface-variant">{e.description}</p>}
                <p className="mt-0.5 text-[11px] text-outline">
                  {fmtDateTime(e.createdAt)}
                  {e.userName ? ` · ${e.userName}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
