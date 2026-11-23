"use client";

import { useState } from "react";

import SubmitButton from "@/components/SubmitButton";
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
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-error/40 px-4 py-2 font-label-md text-label-md text-error transition-all hover:bg-error/10 sm:w-auto"
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
      className="flex w-full max-w-sm flex-col gap-2 rounded-xl border border-error/30 bg-card p-4 shadow-sm"
    >
      <label htmlFor="abandon-reason" className="font-label-md text-label-md text-on-surface-variant">
        Motivo (opcional)
      </label>
      <textarea
        id="abandon-reason"
        name="reason"
        rows={2}
        placeholder="Ex: pedido cancelado pelo fornecedor"
        className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-2.5 font-body-sm text-body-sm focus:border-error focus:outline-none transition-all"
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-outline-variant px-4 py-2 font-label-md text-label-md text-on-surface-variant transition-all hover:bg-surface-container-high"
        >
          Cancelar
        </button>
        <SubmitButton className="rounded-lg bg-error px-4 py-2 font-label-md text-label-md text-white transition-all hover:opacity-90">
          Confirmar abandono
        </SubmitButton>
      </div>
    </form>
  );
}
