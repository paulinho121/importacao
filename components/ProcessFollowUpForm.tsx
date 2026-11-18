import { addProcessFollowUp } from "@/app/processos/actions";

import SubmitButton from "@/components/SubmitButton";
import { PROCESS_STATUS_OPTIONS, STATUS_LABEL, type ProcessStatus } from "@/lib/status";
// Data de hoje no fuso do Brasil (YYYY-MM-DD) — toISOString() usaria UTC e
// viraria o dia depois das 21h.
function todayInSaoPaulo() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

const fieldClass =
  "w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all";

// Follow-up manual + alteração de status no mesmo formulário: quem muda o
// status já registra o andamento junto.
export default function ProcessFollowUpForm({
  processId,
  currentStatus,
}: {
  processId: string;
  currentStatus: string;
}) {
  const boundAdd = addProcessFollowUp.bind(null, processId);
  const statusValue = PROCESS_STATUS_OPTIONS.includes(currentStatus as ProcessStatus) ? currentStatus : "";

  return (
    <form action={boundAdd} className="px-gutter py-4 border-b border-outline-variant flex flex-col gap-3">
      <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-3 max-w-xl">
        <div>
          <label htmlFor="followup-date" className="block font-label-md text-label-md text-on-surface-variant mb-1">
            Data
          </label>
          <input id="followup-date" className={fieldClass} type="date" name="date" defaultValue={todayInSaoPaulo()} required />
        </div>
        <div>
          <label htmlFor="followup-status" className="block font-label-md text-label-md text-on-surface-variant mb-1">
            Status
          </label>
          <select id="followup-status" name="status" defaultValue={statusValue} className={`${fieldClass} appearance-none`}>
            {statusValue === "" && <option value="">Manter o atual</option>}
            {PROCESS_STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <label htmlFor="followup-text" className="block font-label-md text-label-md text-on-surface-variant mb-1">
            Andamento
          </label>
          <input
            id="followup-text"
            className={fieldClass}
            type="text"
            name="text"
            placeholder="Ex: Booking confirmado, HBL aprovado, carga desovada..."
            maxLength={500}
            required
          />
        </div>
        <SubmitButton className="px-5 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all">
          Registrar
        </SubmitButton>
      </div>
    </form>
  );
}
