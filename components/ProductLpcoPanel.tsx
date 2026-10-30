import {
  addProductLpco,
  updateProductLpco,
  removeProductLpco,
} from "@/app/produtos/actions";
import DeleteExternalImportItemButton from "@/components/DeleteExternalImportItemButton";
import { BRANCHES } from "@/lib/locations";
import {
  LPCO_REUSE_DAYS,
  LPCO_TONE_CLASS,
  PRODUCT_LPCO_STATUSES,
  lpcoTone,
  lpcoValidUntil,
  productLpcoStatusLabel,
} from "@/lib/lpco";
import { formatDate } from "@/lib/status";

const INPUT_CLASS =
  "w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all";
const LABEL_CLASS = "block font-label-md text-label-md text-on-surface-variant mb-1";

export type ProductLpcoRow = {
  id: string;
  branch: string;
  status: string;
  requestedAt: string | null;
  approvedAt: string | null;
  lpcoNumber: string | null;
  technicalSheet: boolean | null;
  notes: string | null;
};

function LpcoFields({ lpco, defaultBranch }: { lpco?: ProductLpcoRow; defaultBranch?: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className={LABEL_CLASS}>Filial</label>
        <select className={`${INPUT_CLASS} appearance-none`} name="branch" defaultValue={lpco?.branch ?? defaultBranch ?? ""} required>
          <option value="">Selecione</option>
          {BRANCHES.map((b) => (
            <option key={b.code} value={b.code}>
              {b.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL_CLASS}>Status do LPCO</label>
        <select className={`${INPUT_CLASS} appearance-none`} name="status" defaultValue={lpco?.status ?? "EM_ANALISE"}>
          {PRODUCT_LPCO_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL_CLASS}>Data da solicitação</label>
        <input className={INPUT_CLASS} type="date" name="requestedAt" defaultValue={lpco?.requestedAt ?? ""} />
      </div>
      <div>
        <label className={LABEL_CLASS}>Data do deferimento</label>
        <input className={INPUT_CLASS} type="date" name="approvedAt" defaultValue={lpco?.approvedAt ?? ""} />
      </div>
      <div>
        <label className={LABEL_CLASS}>Nº do LPCO</label>
        <input className={`${INPUT_CLASS} font-mono-data`} type="text" name="lpcoNumber" defaultValue={lpco?.lpcoNumber ?? ""} />
      </div>
      <div>
        <label className={LABEL_CLASS}>Ficha técnica</label>
        <select
          className={`${INPUT_CLASS} appearance-none`}
          name="technicalSheet"
          defaultValue={lpco?.technicalSheet == null ? "" : lpco.technicalSheet ? "sim" : "nao"}
        >
          <option value="">Não informado</option>
          <option value="sim">Sim</option>
          <option value="nao">Não</option>
        </select>
      </div>
      <div className="col-span-2">
        <label className={LABEL_CLASS}>Observação</label>
        <input className={INPUT_CLASS} type="text" name="notes" defaultValue={lpco?.notes ?? ""} />
      </div>
    </div>
  );
}

// Histórico de solicitações de LPCO de um produto, uma faixa por filial.
// Cada deferimento vale LPCO_REUSE_DAYS dias a partir da data de deferimento,
// contados separadamente em cada filial.
export default function ProductLpcoPanel({ productId, lpcos }: { productId: string; lpcos: ProductLpcoRow[] }) {
  const boundAdd = addProductLpco.bind(null, productId);

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 mb-6">
      <h3 className="font-headline-sm text-headline-sm text-primary mb-1">LPCO por Filial</h3>
      <p className="text-on-surface-variant font-body-sm text-body-sm mb-4">
        Solicitações independentes por filial, com histórico. Um LPCO deferido pode ser reutilizado por{" "}
        {LPCO_REUSE_DAYS} dias a partir da data de deferimento (contado em cada filial).
      </p>

      <div className="space-y-4">
        {BRANCHES.map((branch) => {
          const list = lpcos
            .filter((l) => l.branch === branch.code)
            .sort((a, b) => (b.requestedAt ?? b.approvedAt ?? "").localeCompare(a.requestedAt ?? a.approvedAt ?? ""));
          return (
            <section key={branch.code} className="rounded-lg border border-outline-variant p-4">
              <h4 className="font-label-md text-label-md text-primary mb-2">{branch.label}</h4>
              {list.length === 0 ? (
                <p className="text-body-sm font-body-sm text-on-surface-variant">Nenhuma solicitação registrada.</p>
              ) : (
                <ul className="space-y-3">
                  {list.map((l) => {
                    const tone = lpcoTone(l);
                    const until = l.status === "DEFERIDO" ? lpcoValidUntil(l.approvedAt) : null;
                    return (
                      <li key={l.id} className="text-body-sm font-body-sm border-b border-outline-variant/50 pb-3 last:border-0 last:pb-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LPCO_TONE_CLASS[tone]}`}>
                            {tone === "expired" ? "Deferido (prazo vencido)" : productLpcoStatusLabel(l.status)}
                          </span>
                          {l.lpcoNumber && <span className="font-mono-data">Nº {l.lpcoNumber}</span>}
                          {l.technicalSheet !== null && (
                            <span className="text-xs text-on-surface-variant">
                              Ficha técnica: {l.technicalSheet ? "Sim" : "Não"}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          Solicitação: {formatDate(l.requestedAt)}
                          {" · "}Deferimento: {l.status === "DEFERIDO" ? formatDate(l.approvedAt) : "aguardando"}
                          {until && ` · Reutilizável até ${formatDate(until)}`}
                        </p>
                        {l.notes && <p className="mt-0.5 text-xs text-on-surface-variant">{l.notes}</p>}
                        <details className="mt-1.5">
                          <summary className="cursor-pointer text-xs text-secondary hover:underline list-none inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">edit_note</span>
                            Editar
                          </summary>
                          <form action={updateProductLpco.bind(null, l.id, productId)} className="mt-2 space-y-2">
                            <LpcoFields lpco={l} />
                            <button
                              type="submit"
                              className="px-3 py-1.5 rounded-lg bg-secondary text-white text-xs font-bold hover:opacity-90 transition-all"
                            >
                              Salvar
                            </button>
                          </form>
                          <div className="mt-1.5">
                            <DeleteExternalImportItemButton
                              action={removeProductLpco.bind(null, l.id, productId)}
                              description={`LPCO ${branch.label}`}
                              compact
                            />
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-secondary hover:underline list-none inline-flex items-center gap-1 font-label-md text-label-md">
          <span className="material-symbols-outlined text-[16px]">add</span>
          Nova solicitação de LPCO
        </summary>
        <form action={boundAdd} className="mt-3 space-y-2">
          <LpcoFields />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all"
          >
            Registrar solicitação
          </button>
        </form>
      </details>
    </div>
  );
}
