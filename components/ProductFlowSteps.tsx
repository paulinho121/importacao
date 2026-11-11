import { BRANCHES } from "@/lib/locations";
import { LPCO_COUNTDOWN_BAR, LPCO_REUSE_DAYS, lpcoCountdown } from "@/lib/lpco";
import {
  CP_IN_PROGRESS_STATUSES,
  cpStatusLabel,
  hasPublicConsultation,
  missingRegistrationItems,
  type ProductFlowInput,
} from "@/lib/product-flow";
import { formatDate } from "@/lib/status";

type Lpco = { branch: string; status: string; approvedAt: string | null; validUntil: string | null };
type Tone = "done" | "doing" | "todo";

const TONE_CLASS: Record<Tone, string> = {
  done: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  doing: "bg-warning/20 text-warning",
  todo: "bg-surface-container-high text-on-surface-variant",
};

function Step({
  n,
  title,
  tone,
  badge,
  children,
}: {
  n: number;
  title: string;
  tone: Tone;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
            tone === "done" ? "bg-secondary text-white" : "bg-surface-container-high text-on-surface-variant"
          }`}
        >
          {tone === "done" ? "✓" : n}
        </span>
        <h3 className="font-label-md text-label-md text-primary">{title}</h3>
        <span className={`ml-auto px-2 py-0.5 rounded-full text-[11px] font-bold ${TONE_CLASS[tone]}`}>{badge}</span>
      </div>
      <div className="text-body-sm font-body-sm text-on-surface-variant">{children}</div>
    </div>
  );
}

// As 3 etapas do produto: cadastro completo → consulta pública → benefício
// (LPCO) por estado, com a contagem dos 180 dias.
export default function ProductFlowSteps({
  product,
  lpcos,
}: {
  product: ProductFlowInput & { cpRequestedAt: string | null; cpListRef: string | null };
  lpcos: Lpco[];
}) {
  const missing = missingRegistrationItems(product);
  const registrationDone = missing.length === 0;

  const cpDone = hasPublicConsultation(product);
  const cpRequested = !!product.cpStatus && CP_IN_PROGRESS_STATUSES.includes(product.cpStatus);
  const cpDenied = product.cpStatus === "INDEFERIDO";

  // Benefício vigente por estado: o deferido com validade mais longa.
  const benefits = BRANCHES.map((b) => {
    const list = lpcos.filter((l) => l.branch === b.code);
    const active = list
      .filter((l) => l.status === "DEFERIDO")
      .map((l) => ({ l, c: lpcoCountdown(l.approvedAt, undefined, l.validUntil) }))
      .filter((x) => x.c !== null)
      .sort((x, y) => y.c!.daysLeft - x.c!.daysLeft)[0];
    const pending = list.some((l) => l.status === "EM_ANALISE");
    return { code: b.code, active, pending };
  });
  const anyValid = benefits.some((b) => b.active && !b.active.c!.expired);
  const anyBenefit = benefits.some((b) => b.active || b.pending);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
      <Step
        n={1}
        title="Cadastro do item"
        tone={registrationDone ? "done" : "doing"}
        badge={registrationDone ? "Completo" : "Incompleto"}
      >
        {registrationDone ? "Nome, SKUs, NCM, fornecedor e foto preenchidos." : `Falta: ${missing.join(", ")}.`}
      </Step>

      <Step
        n={2}
        title="Consulta Pública"
        tone={cpDone ? "done" : cpRequested ? "doing" : "todo"}
        badge={cpDone ? "Deferida" : cpRequested ? (cpStatusLabel(product.cpStatus) ?? "Em andamento") : cpDenied ? "Indeferida" : "Verificar"}
      >
        {cpDone
          ? `Consulta pública deferida${product.cpListRef ? ` (CP ${product.cpListRef.split(", ")[0]})` : ""}.`
          : cpRequested
            ? `${cpStatusLabel(product.cpStatus)}${product.cpRequestedAt ? ` — solicitada em ${formatDate(product.cpRequestedAt)}` : ""}. Acompanhe o resultado.`
            : cpDenied
              ? "Consulta pública indeferida: veja a exigência ou solicite de novo."
              : "Confira na lista pública do governo (envie a planilha em Produtos) se o item já tem consulta pública."}
      </Step>

      <Step
        n={3}
        title={`Benefício por estado (${LPCO_REUSE_DAYS} dias)`}
        tone={anyValid ? "done" : anyBenefit ? "doing" : "todo"}
        badge={anyValid ? "Vigente" : anyBenefit ? "Em andamento" : cpDone ? "Pedir" : "Aguardando CP"}
      >
        <div className="flex flex-col gap-1.5">
          {benefits.map((b) => {
            const c = b.active?.c;
            return (
              <div key={b.code} className="flex items-center gap-2">
                <span className="w-6 font-bold text-primary">{b.code}</span>
                {c ? (
                  <div className="flex-1">
                    <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                      <div className={`h-full ${LPCO_COUNTDOWN_BAR[c.level]}`} style={{ width: `${c.pctLeft}%` }} />
                    </div>
                    <span className="text-[11px]">
                      {c.expired ? `vencido há ${Math.abs(c.daysLeft)} d` : `faltam ${c.daysLeft} de ${c.total} dias`}
                    </span>
                  </div>
                ) : (
                  <span className="text-[11px]">{b.pending ? "em análise" : "sem benefício"}</span>
                )}
              </div>
            );
          })}
        </div>
      </Step>
    </div>
  );
}
