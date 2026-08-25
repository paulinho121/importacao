"use client";

export default function DeletePurchaseOrderButton({
  action,
  poNumber,
  compact = false,
}: {
  action: () => void;
  poNumber: string;
  compact?: boolean;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Excluir o pedido ${poNumber}? Essa ação não pode ser desfeita.`)) {
          e.preventDefault();
        }
      }}
    >
      {compact ? (
        <button
          type="submit"
          className="flex items-center gap-1 text-error hover:underline w-fit"
        >
          <span className="material-symbols-outlined text-[16px]">delete</span>
          Excluir
        </button>
      ) : (
        <button
          type="submit"
          className="w-full px-4 py-2.5 rounded-lg border border-error text-error font-label-md text-label-md hover:bg-error-container/20 transition-all"
        >
          Excluir Pedido
        </button>
      )}
    </form>
  );
}
