"use client";

// Botão de formulário que pede confirmação antes de executar a ação.
export default function ConfirmActionButton({
  action,
  label,
  message,
  className = "text-error hover:underline text-xs",
}: {
  action: () => void;
  label: string;
  message: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
