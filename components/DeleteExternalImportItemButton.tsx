"use client";

import SubmitButton from "@/components/SubmitButton";

export default function DeleteExternalImportItemButton({
  action,
  description,
  compact = false,
}: {
  action: () => void;
  description: string;
  compact?: boolean;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Excluir o item "${description}"? Essa ação não pode ser desfeita.`)) {
          e.preventDefault();
        }
      }}
    >
      {compact ? (
        <SubmitButton className="text-error hover:underline text-xs">
          Excluir
        </SubmitButton>
      ) : (
        <SubmitButton
          className="w-full px-4 py-2.5 rounded-lg border border-error text-error font-label-md text-label-md hover:bg-error-container/20 transition-all"
        >
          Excluir Item
        </SubmitButton>
      )}
    </form>
  );
}
