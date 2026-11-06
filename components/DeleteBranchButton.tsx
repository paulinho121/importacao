"use client";

import SubmitButton from "@/components/SubmitButton";

export default function DeleteBranchButton({ action, name }: { action: () => void; name: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Excluir a filial "${name}"?`)) e.preventDefault();
      }}
    >
      <SubmitButton className="text-error hover:underline text-xs">
        Excluir
      </SubmitButton>
    </form>
  );
}
