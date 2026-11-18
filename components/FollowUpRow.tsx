"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { removeProcessFollowUp, updateProcessFollowUp } from "@/app/processos/actions";
import SubmitButton from "@/components/SubmitButton";

// Linha do histórico do processo. Andamentos manuais podem ser editados
// (data e texto) e removidos; os automáticos ("Processo criado") são só leitura.
const input =
  "w-full bg-surface-container-low border border-outline-variant rounded-lg p-1.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all";

export default function FollowUpRow({
  id,
  processId,
  isManual,
  dateLabel,
  dateValue,
  text,
  origin,
  statusLabel,
}: {
  id: string;
  processId: string;
  isManual: boolean;
  dateLabel: string;
  dateValue: string;
  text: string;
  origin: string;
  statusLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(dateValue);
  const [value, setValue] = useState(text);
  const [pending, startTransition] = useTransition();

  function startEdit() {
    setDate(dateValue);
    setValue(text);
    setEditing(true);
  }

  function save() {
    const formData = new FormData();
    formData.set("date", date);
    formData.set("text", value);
    startTransition(async () => {
      try {
        const res = await updateProcessFollowUp(id, processId, formData);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Andamento atualizado.");
        setEditing(false);
      } catch {
        toast.error("Não foi possível salvar o andamento. Tente novamente.");
      }
    });
  }

  return (
    <tr className="hover:bg-surface-container-high transition-colors align-top">
      <td className="px-6 py-3 font-mono-data whitespace-nowrap">
        {editing ? (
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Data do andamento"
            className={input}
            required
          />
        ) : (
          dateLabel
        )}
      </td>
      <td className="px-6 py-3 font-medium">
        {editing ? (
          <input
            type="text"
            value={value}
            maxLength={500}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Texto do andamento"
            className={`${input} min-w-[16rem]`}
            required
          />
        ) : (
          text
        )}
      </td>
      <td className="px-6 py-3">{origin}</td>
      <td className="px-6 py-3">{statusLabel}</td>
      <td className="px-6 py-3 text-right whitespace-nowrap">
        {isManual &&
          (editing ? (
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={save}
                disabled={pending || !value.trim() || !date}
                className="text-secondary font-bold hover:underline text-xs disabled:opacity-50"
              >
                {pending ? "Salvando…" : "Salvar"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={pending}
                className="text-on-surface-variant hover:underline text-xs"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={startEdit}
                className="text-secondary hover:underline text-xs"
                aria-label="Editar andamento"
              >
                Editar
              </button>
              <form action={removeProcessFollowUp.bind(null, id, processId)}>
                <SubmitButton className="text-error hover:underline text-xs" aria-label="Remover andamento">
                  Remover
                </SubmitButton>
              </form>
            </div>
          ))}
      </td>
    </tr>
  );
}
