import {
  updateCustomsChannel,
  addProcessLpco,
  updateProcessLpco,
} from "@/app/processos/actions";
import {
  CUSTOMS_CHANNEL_LABEL,
  CUSTOMS_CHANNEL_BADGE_CLASS,
  LPCO_AGENCY_LABEL,
  LICENSE_STATUS_LABEL,
  LICENSE_STATUS_BADGE_CLASS,
  diasRestantes,
  formatDate,
  type CustomsChannel,
  type LpcoAgency,
  type LicenseStatus,
} from "@/lib/status";

const CHANNELS: CustomsChannel[] = ["VERDE", "AMARELO", "VERMELHO", "CINZA"];
const AGENCIES: LpcoAgency[] = ["ANVISA", "MAPA", "INMETRO", "IBAMA", "EXERCITO", "ANP", "DECEX", "OUTRO"];
const LICENSE_STATUSES: LicenseStatus[] = [
  "A_REGISTRAR",
  "PARA_ANALISE",
  "EM_CONSULTA_PUBLICA",
  "EM_EXIGENCIA",
  "DEFERIDA",
  "CANCELADA_INDEFERIDA",
];

export type ProcessLpcoData = {
  id: string;
  agency: LpcoAgency;
  lpcoNumber: string | null;
  status: LicenseStatus;
  issuedAt: string | null;
  validUntil: string | null;
  notes: string | null;
};

export default function ProcessCompliance({
  processId,
  customsChannel,
  lpcos,
}: {
  processId: string;
  customsChannel: CustomsChannel | null;
  lpcos: ProcessLpcoData[];
}) {
  const boundUpdateChannel = updateCustomsChannel.bind(null, processId);
  const boundAddLpco = addProcessLpco.bind(null, processId);

  return (
    <section className="bg-white border border-outline-variant p-gutter rounded-xl shadow-sm">
      <h3 className="font-headline-sm text-headline-sm text-primary mb-stack-md">
        Compliance / LPCOs
      </h3>

      <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-outline-variant">
        <span className="font-label-md text-label-md text-outline">Canal de Parametrização</span>
        {customsChannel && (
          <span
            className={`px-3 py-1 rounded-full font-label-md text-label-md ${CUSTOMS_CHANNEL_BADGE_CLASS[customsChannel]}`}
          >
            {CUSTOMS_CHANNEL_LABEL[customsChannel]}
          </span>
        )}
        <form action={boundUpdateChannel} className="flex items-center gap-2 sm:ml-auto">
          <select
            name="customsChannel"
            defaultValue={customsChannel ?? ""}
            className="bg-surface-container-low border border-outline-variant rounded-lg p-2 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all appearance-none"
          >
            <option value="">Sem canal definido</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CUSTOMS_CHANNEL_LABEL[c]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg border border-outline text-primary font-label-md text-label-md hover:bg-surface-container-high transition-all"
          >
            Salvar
          </button>
        </form>
      </div>

      <div className="mt-4">
        <span className="font-label-md text-label-md text-outline block mb-2">LPCOs deste processo</span>
        {lpcos.length === 0 ? (
          <p className="text-on-surface-variant font-body-sm text-body-sm mb-3">
            Nenhuma LPCO registrada ainda.
          </p>
        ) : (
          <ul className="space-y-3 mb-4">
            {lpcos.map((lpco) => {
              const boundUpdateLpco = updateProcessLpco.bind(null, lpco.id, processId);
              const dias = diasRestantes(lpco.validUntil);
              const isExpired = dias !== null && dias < 0;
              const isExpiringSoon = dias !== null && dias >= 0 && dias <= 15;
              return (
                <li key={lpco.id} className="border border-outline-variant rounded-lg p-3">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="px-2 py-1 rounded-full font-label-md text-label-md bg-surface-container-high text-on-surface-variant">
                      {LPCO_AGENCY_LABEL[lpco.agency]}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full font-label-md text-label-md ${LICENSE_STATUS_BADGE_CLASS[lpco.status]}`}
                    >
                      {LICENSE_STATUS_LABEL[lpco.status]}
                    </span>
                    {lpco.validUntil && (
                      <span
                        className={`text-xs font-medium ${
                          isExpired || isExpiringSoon ? "text-error" : "text-on-surface-variant"
                        }`}
                      >
                        {isExpired
                          ? `Vencida há ${Math.abs(dias!)}d`
                          : `Válida até ${formatDate(lpco.validUntil)} (${dias}d)`}
                      </span>
                    )}
                  </div>
                  <form action={boundUpdateLpco} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input
                      className="bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs font-mono-data focus:outline-none focus:border-secondary transition-all"
                      placeholder="Número"
                      type="text"
                      name="lpcoNumber"
                      defaultValue={lpco.lpcoNumber ?? ""}
                    />
                    <select
                      name="status"
                      defaultValue={lpco.status}
                      className="bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:border-secondary transition-all appearance-none"
                    >
                      {LICENSE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {LICENSE_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                    <input
                      className="bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:border-secondary transition-all"
                      type="date"
                      name="validUntil"
                      defaultValue={lpco.validUntil ?? ""}
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 rounded-lg border border-outline text-primary text-xs font-bold hover:bg-surface-container-high transition-all"
                    >
                      Salvar
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        <form
          action={boundAddLpco}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-outline-variant"
        >
          <select
            name="agency"
            required
            defaultValue=""
            className="bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:border-secondary transition-all appearance-none"
          >
            <option value="" disabled>
              Órgão anuente
            </option>
            {AGENCIES.map((a) => (
              <option key={a} value={a}>
                {LPCO_AGENCY_LABEL[a]}
              </option>
            ))}
          </select>
          <input
            className="bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs font-mono-data focus:outline-none focus:border-secondary transition-all"
            placeholder="Número (opcional)"
            type="text"
            name="lpcoNumber"
          />
          <input
            className="bg-surface-container-low border border-outline-variant rounded-lg p-2 text-xs focus:outline-none focus:border-secondary transition-all"
            type="date"
            name="validUntil"
            title="Validade (opcional)"
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 transition-all"
          >
            Adicionar LPCO
          </button>
        </form>
      </div>
    </section>
  );
}
