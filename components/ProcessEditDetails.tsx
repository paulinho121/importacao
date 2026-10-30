import { updateProcessDetails } from "@/app/processos/actions";
import { LOCATIONS, locationLabel } from "@/lib/locations";
import { MODAIS } from "@/lib/modais";

const INPUT_CLASS =
  "w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all";
const LABEL_CLASS = "block font-label-md text-label-md text-on-surface-variant mb-1";

export type ProcessEditDefaults = {
  modal: string | null;
  agentId: string | null;
  etd: string | null;
  etaEstimated: string | null;
  etaActual: string | null;
  destination: string | null;
  destinationCode: string | null;
  destinationCity: string | null;
  destinationState: string | null;
  weightKg: string | null;
  volumeM3: string | null;
  notes: string | null;
};

export default function ProcessEditDetails({
  processId,
  defaults,
  agents,
}: {
  processId: string;
  defaults: ProcessEditDefaults;
  agents: { id: string; name: string }[];
}) {
  const bound = updateProcessDetails.bind(null, processId);

  // Destino atual no formato do <select> ("CODE|Cidade|UF"); se o processo
  // tem destino que não está na lista conhecida, cai em "Outro".
  const knownLocation = LOCATIONS.find((l) => l.code === defaults.destinationCode);
  const locationValue = knownLocation
    ? `${knownLocation.code}|${knownLocation.city}|${knownLocation.state}`
    : defaults.destination || defaults.destinationCode
      ? "OUTRO"
      : "";
  const freeText = knownLocation
    ? ""
    : (defaults.destination ??
      (defaults.destinationCode
        ? locationLabel(defaults.destinationCode, defaults.destinationCity ?? "", defaults.destinationState ?? "")
        : ""));

  return (
    <details className="mt-4 pt-4 border-t border-outline-variant">
      <summary className="cursor-pointer text-secondary hover:underline list-none inline-flex items-center gap-1 font-label-md text-label-md">
        <span className="material-symbols-outlined text-[16px]">edit</span>
        Editar dados do processo
      </summary>

      <form action={bound} className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASS}>Modal</label>
          <select className={`${INPUT_CLASS} appearance-none`} name="modal" defaultValue={defaults.modal ?? ""}>
            {MODAIS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Agente de carga</label>
          <select className={`${INPUT_CLASS} appearance-none`} name="agentId" defaultValue={defaults.agentId ?? ""}>
            <option value="">Sem agente</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>ETD (saída)</label>
          <input className={INPUT_CLASS} type="date" name="etd" defaultValue={defaults.etd ?? ""} />
        </div>
        <div>
          <label className={LABEL_CLASS}>ETA estimado (chegada)</label>
          <input className={INPUT_CLASS} type="date" name="etaEstimated" defaultValue={defaults.etaEstimated ?? ""} />
        </div>
        <div>
          <label className={LABEL_CLASS}>ETA real</label>
          <input className={INPUT_CLASS} type="date" name="etaActual" defaultValue={defaults.etaActual ?? ""} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Destino</label>
          <select className={`${INPUT_CLASS} appearance-none`} name="locationChoice" defaultValue={locationValue}>
            <option value="">Sem destino</option>
            {LOCATIONS.map((loc) => (
              <option key={loc.code} value={`${loc.code}|${loc.city}|${loc.state}`}>
                {locationLabel(loc.code, loc.city, loc.state)}
              </option>
            ))}
            <option value="OUTRO">Outro (descrever abaixo)</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL_CLASS}>Destino fora da lista (só se escolheu &quot;Outro&quot;)</label>
          <input
            className={INPUT_CLASS}
            type="text"
            name="destination"
            defaultValue={freeText}
            placeholder="Ex: cidade/porto não listado"
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Peso (kg)</label>
          <input className={INPUT_CLASS} type="number" step="0.01" name="weightKg" defaultValue={defaults.weightKg ?? ""} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Volume (m³)</label>
          <input className={INPUT_CLASS} type="number" step="0.01" name="volumeM3" defaultValue={defaults.volumeM3 ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL_CLASS}>Observações</label>
          <textarea className={INPUT_CLASS} name="notes" rows={3} defaultValue={defaults.notes ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all"
          >
            Salvar alterações
          </button>
        </div>
      </form>
    </details>
  );
}
