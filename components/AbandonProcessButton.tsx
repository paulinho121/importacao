"use client";

import { useState } from "react";

export default function AbandonProcessButton({
  action,
  processNumber,
}: {
  action: (formData: FormData) => void;
  processNumber: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-error text-error font-label-md text-label-md hover:bg-error-container/20 transition-all"
      >
        <span className="material-symbols-outlined text-[18px]">cancel</span>
        Abandonar Processo
      </button>
    );
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(
            `Abandonar o processo ${processNumber}? Ele é encerrado imediatamente e sai da lista de processos ativos. Essa ação não pode ser desfeita.`,
          )
        ) {
          e.preventDefault();
        }
      }}
      className="flex flex-col gap-2 bg-error-container/10 border border-error/30 rounded-xl p-3 max-w-sm"
    >
      <label className="font-label-md text-label-md text-on-surface-variant">
        Motivo (opcional)
      </label>
      <textarea
        name="reason"
        rows={2}
        placeholder="Ex: pedido cancelado pelo fornecedor"
        className="bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-error transition-all"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-error text-white font-label-md text-label-md hover:opacity-90 transition-all"
        >
          Confirmar abandono
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant font-label-md text-label-md hover:bg-surface-container-high transition-all"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
