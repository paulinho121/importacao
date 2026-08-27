"use client";

import { EXTERNAL_IMPORT_ITEM_STATUS_LABEL, type ExternalImportItemStatus } from "@/lib/status";

export type ExternalImportItemDefaults = {
  sku: string | null;
  description: string;
  quantity: string | null;
  supplierName: string | null;
  processNumber: string | null;
  status: ExternalImportItemStatus | null;
  modal: string | null;
  invoice: string | null;
  etd: string | null;
  eta: string | null;
  agent: string | null;
  destination: string | null;
  reservation: string | null;
  notes: string | null;
};

const STATUS_OPTIONS = Object.keys(EXTERNAL_IMPORT_ITEM_STATUS_LABEL) as ExternalImportItemStatus[];

export default function ExternalImportItemEditForm({
  action,
  defaultValues,
  submitLabel = "Salvar",
}: {
  action: (formData: FormData) => void;
  defaultValues?: Partial<ExternalImportItemDefaults>;
  submitLabel?: string;
}) {
  const d = defaultValues ?? {};
  return (
    <form action={action} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="sm:col-span-2">
        <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Descrição</label>
        <input
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
          type="text"
          name="description"
          defaultValue={d.description ?? ""}
          required
        />
      </div>
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-1">SKU</label>
        <input
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm font-mono-data focus:outline-none focus:border-secondary transition-all"
          type="text"
          name="sku"
          defaultValue={d.sku ?? ""}
        />
      </div>
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Quantidade</label>
        <input
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
          type="number"
          step="0.01"
          name="quantity"
          defaultValue={d.quantity ?? ""}
        />
      </div>
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Fornecedor</label>
        <input
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
          type="text"
          name="supplierName"
          defaultValue={d.supplierName ?? ""}
        />
      </div>
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-1">
          Nº Processo / Referência
        </label>
        <input
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm font-mono-data focus:outline-none focus:border-secondary transition-all"
          type="text"
          name="processNumber"
          defaultValue={d.processNumber ?? ""}
        />
      </div>
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Status</label>
        <select
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all appearance-none"
          name="status"
          defaultValue={d.status ?? ""}
        >
          <option value="">—</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {EXTERNAL_IMPORT_ITEM_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Modal</label>
        <input
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
          type="text"
          name="modal"
          placeholder="AIR, SEA, COURIER..."
          defaultValue={d.modal ?? ""}
        />
      </div>
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Invoice</label>
        <input
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm font-mono-data focus:outline-none focus:border-secondary transition-all"
          type="text"
          name="invoice"
          defaultValue={d.invoice ?? ""}
        />
      </div>
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-1">ETD</label>
        <input
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
          type="date"
          name="etd"
          defaultValue={d.etd ?? ""}
        />
      </div>
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-1">ETA</label>
        <input
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
          type="date"
          name="eta"
          defaultValue={d.eta ?? ""}
        />
      </div>
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Agente</label>
        <input
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
          type="text"
          name="agent"
          defaultValue={d.agent ?? ""}
        />
      </div>
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Destino</label>
        <input
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
          type="text"
          name="destination"
          defaultValue={d.destination ?? ""}
        />
      </div>
      <div>
        <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Reserva</label>
        <input
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
          type="text"
          name="reservation"
          placeholder="Pra quem está reservado"
          defaultValue={d.reservation ?? ""}
        />
      </div>
      <div className="sm:col-span-3">
        <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Observações</label>
        <textarea
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
          name="notes"
          rows={2}
          defaultValue={d.notes ?? ""}
        />
      </div>
      <div className="sm:col-span-3">
        <button
          type="submit"
          className="px-6 py-2.5 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
