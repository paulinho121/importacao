"use client";

import { useState } from "react";
import {
  updateExternalImportItem,
  deleteExternalImportItem,
} from "@/app/em-importacao/actions";
import ExternalImportItemEditForm, {
  type ExternalImportItemDefaults,
} from "@/components/ExternalImportItemEditForm";
import {
  EXTERNAL_IMPORT_ITEM_STATUS_LABEL,
  EXTERNAL_IMPORT_ITEM_STATUS_BADGE_CLASS,
  formatDate,
  type ExternalImportItemStatus,
} from "@/lib/status";

export type ExternalImportItemRowData = ExternalImportItemDefaults & { id: string };

export default function ExternalImportItemRow({ item }: { item: ExternalImportItemRowData }) {
  const [editing, setEditing] = useState(false);
  const status = item.status as ExternalImportItemStatus | null;

  return (
    <>
      <tr className="hover:bg-surface-container-high transition-colors">
        <td className="px-6 py-3 font-mono-data">{item.sku ?? "—"}</td>
        <td className="px-6 py-3 max-w-[280px] truncate" title={item.description}>
          {item.description}
        </td>
        <td className="px-6 py-3 font-mono-data">{item.quantity ?? "—"}</td>
        <td className="px-6 py-3">{item.supplierName ?? "—"}</td>
        <td className="px-6 py-3 font-mono-data">{item.processNumber ?? "—"}</td>
        <td className="px-6 py-3">
          {status ? (
            <span
              className={`px-2 py-1 rounded-full font-label-md text-label-md ${EXTERNAL_IMPORT_ITEM_STATUS_BADGE_CLASS[status]}`}
            >
              {EXTERNAL_IMPORT_ITEM_STATUS_LABEL[status]}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="px-6 py-3">{formatDate(item.eta)}</td>
        <td className="px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="flex items-center gap-1 text-secondary hover:underline w-fit"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              Editar
            </button>
            <form
              action={() => {
                if (confirm(`Excluir o item "${item.description}"?`)) {
                  deleteExternalImportItem(item.id);
                }
              }}
            >
              <button type="submit" className="text-error hover:underline text-xs">
                Excluir
              </button>
            </form>
          </div>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={8} className="px-6 py-5 bg-surface-container-low border-t border-outline-variant">
            <ExternalImportItemEditForm
              action={(formData) => {
                updateExternalImportItem(item.id, formData);
                setEditing(false);
              }}
              defaultValues={item}
              submitLabel="Salvar alterações"
            />
          </td>
        </tr>
      )}
    </>
  );
}
