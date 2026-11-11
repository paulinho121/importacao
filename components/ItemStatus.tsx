import { BRANCHES } from "@/lib/locations";
import { LPCO_TONE_CLASS, lpcoCountdown, lpcoTone, productLpcoStatusLabel } from "@/lib/lpco";
import { CP_LIST_RESULT_CLASS, CP_LIST_RESULT_LABEL, type CpListResult } from "@/lib/cp-list";
import { CP_IN_PROGRESS_STATUSES, cpStatusLabel, hasPublicConsultation } from "@/lib/product-flow";

export type ItemLpco = {
  branch: string;
  status: string;
  approvedAt: string | null;
  validUntil: string | null;
  requestedAt: string | null;
};

// LPCO mais recente de cada estado (SP/SC/CE) — verde só quando deferido e
// dentro do prazo; "em análise" e os dias restantes aparecem acima do selo.
// `highlight` marca o estado de destino do processo com um contorno.
export function LpcoUfChips({ lpcos, highlight = null }: { lpcos: ItemLpco[]; highlight?: string | null }) {
  return (
    <div className="flex gap-2">
      {BRANCHES.map((b) => {
        const list = lpcos.filter((l) => l.branch === b.code);
        const l = list.sort((x, y) => (y.requestedAt ?? y.approvedAt ?? "").localeCompare(x.requestedAt ?? x.approvedAt ?? ""))[0];
        const tone = l ? lpcoTone(l) : "none";
        const countdown = l?.status === "DEFERIDO" ? lpcoCountdown(l.approvedAt, undefined, l.validUntil) : null;
        return (
          <span
            key={b.code}
            title={l ? `${b.label}: ${productLpcoStatusLabel(l.status)}` : `${b.label}: sem solicitação`}
            className="flex flex-col items-center gap-0.5"
          >
            <span className="h-3 whitespace-nowrap text-[10px] leading-3 text-on-surface-variant">
              {tone === "wait" ? "em análise" : countdown ? (countdown.expired ? "vencido" : `${countdown.daysLeft}d`) : ""}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-xs font-bold ${LPCO_TONE_CLASS[tone]} ${highlight === b.code ? "ring-2 ring-secondary ring-offset-1 ring-offset-surface-container-lowest" : ""}`}
            >
              {b.code}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export function CpBadge({ cpStatus, cpListResult }: { cpStatus: string | null; cpListResult: string | null }) {
  const has = hasPublicConsultation({ cpStatus, cpListResult });
  const label = has ? "CP: deferida" : `CP: ${cpStatusLabel(cpStatus)?.toLowerCase() ?? "não verificada"}`;
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${
        has
          ? LPCO_TONE_CLASS.ok
          : cpStatus && CP_IN_PROGRESS_STATUSES.includes(cpStatus)
            ? "bg-warning/20 text-warning"
            : cpStatus === "INDEFERIDO"
              ? "bg-error-container text-on-error-container"
              : LPCO_TONE_CLASS.none
      }`}
    >
      {label}
    </span>
  );
}

export function ListBadge({ cpListResult }: { cpListResult: string | null }) {
  if (!cpListResult || cpListResult === "NOT_FOUND") return null;
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${CP_LIST_RESULT_CLASS[cpListResult as CpListResult]}`}
    >
      {CP_LIST_RESULT_LABEL[cpListResult as CpListResult]}
    </span>
  );
}

// Foto do produto (ou um espaço reservado) em caixa com proporção fixa.
export function ItemPhoto({ url, alt, className = "" }: { url: string | null; alt: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center overflow-hidden bg-white ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto pode vir de qualquer link externo
        <img src={url} alt={alt} className="h-full w-full object-contain" loading="lazy" />
      ) : (
        <span className="material-symbols-outlined text-[48px] text-outline-variant" aria-hidden>
          image
        </span>
      )}
    </div>
  );
}
