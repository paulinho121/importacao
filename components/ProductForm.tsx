export type ProductFormValues = {
  sku?: string | null;
  manufacturerSku?: string | null;
  ncm?: string | null;
  description?: string | null;
  defaultSupplierId?: string | null;
};

export default function ProductForm({
  action,
  defaultValues,
  submitLabel,
  suppliers,
}: {
  action: (formData: FormData) => void;
  defaultValues?: ProductFormValues;
  submitLabel: string;
  suppliers: { id: string; name: string }[];
}) {
  return (
    <form action={action} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="sm:col-span-2">
          <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
            Descrição do Produto
          </label>
          <input
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
            placeholder="ex: Power Adapter Assembly (LS 600d Pro)"
            type="text"
            name="description"
            defaultValue={defaultValues?.description ?? ""}
            required
          />
        </div>
        <div>
          <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
            SKU Interno
          </label>
          <input
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md font-mono-data focus:outline-none focus:border-secondary transition-all"
            placeholder="ex: SE0000001G"
            type="text"
            name="sku"
            defaultValue={defaultValues?.sku ?? ""}
            required
          />
        </div>
        <div>
          <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
            SKU do Fabricante
          </label>
          <input
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md font-mono-data focus:outline-none focus:border-secondary transition-all"
            placeholder="ex: AP20334A20"
            type="text"
            name="manufacturerSku"
            defaultValue={defaultValues?.manufacturerSku ?? ""}
          />
        </div>
        <div>
          <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
            NCM
          </label>
          <input
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md font-mono-data focus:outline-none focus:border-secondary transition-all"
            placeholder="ex: 8544.42.00"
            type="text"
            name="ncm"
            maxLength={12}
            defaultValue={defaultValues?.ncm ?? ""}
          />
        </div>
        <div>
          <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
            Fornecedor Padrão
          </label>
          <select
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all appearance-none"
            name="defaultSupplierId"
            defaultValue={defaultValues?.defaultSupplierId ?? ""}
          >
            <option value="">Nenhum</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-2">
        <button
          type="submit"
          className="px-8 py-3 rounded-lg bg-secondary text-white font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
