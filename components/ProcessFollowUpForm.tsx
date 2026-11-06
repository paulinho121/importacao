import { addProcessFollowUp } from "@/app/processos/actions";

import SubmitButton from "@/components/SubmitButton";
// Data de hoje no fuso do Brasil (YYYY-MM-DD) — toISOString() usaria UTC e
// viraria o dia depois das 21h.
function todayInSaoPaulo() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export default function ProcessFollowUpForm({ processId }: { processId: string }) {
  const boundAdd = addProcessFollowUp.bind(null, processId);

  return (
    <form
      action={boundAdd}
      className="px-gutter py-4 border-b border-outline-variant grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-3 items-end"
    >
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Data</label>
        <input
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
          type="date"
          name="date"
          defaultValue={todayInSaoPaulo()}
          required
        />
      </div>
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-1">
          Andamento
        </label>
        <input
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
          type="text"
          name="text"
          placeholder="Ex: Booking confirmado, HBL aprovado, carga desovada..."
          maxLength={500}
          required
        />
      </div>
      <SubmitButton
        className="px-5 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all"
      >
        Registrar
      </SubmitButton>
    </form>
  );
}
