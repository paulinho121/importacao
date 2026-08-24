"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden fixed top-4 right-4 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary text-white font-medium shadow-lg hover:opacity-90 transition-all"
    >
      <span className="material-symbols-outlined text-[18px]">print</span>
      Imprimir / Salvar PDF
    </button>
  );
}
