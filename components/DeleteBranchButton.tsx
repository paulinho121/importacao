"use client";

export default function DeleteBranchButton({ action, name }: { action: () => void; name: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Excluir a filial "${name}"?`)) e.preventDefault();
      }}
    >
      <button type="submit" className="text-error hover:underline text-xs">
        Excluir
      </button>
    </form>
  );
}
