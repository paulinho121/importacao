"use client";

import { useState } from "react";
import { createExternalImportItem } from "@/app/em-importacao/actions";
import ExternalImportItemEditForm from "@/components/ExternalImportItemEditForm";

export default function ExternalImportItemCreatePanel() {
  const [open, setOpen] = useState(false);

  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-container-high transition-colors"
      >
        <span className="font-label-lg text-label-lg text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">add_circle</span>
          Novo item em importação
        </span>
        <span className="material-symbols-outlined text-on-surface-variant">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>
      {open && (
        <div className="px-6 pb-6 border-t border-outline-variant pt-4">
          <ExternalImportItemEditForm
            action={(formData) => {
              createExternalImportItem(formData);
              setOpen(false);
            }}
            submitLabel="Cadastrar item"
          />
        </div>
      )}
    </section>
  );
}
