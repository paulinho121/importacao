import { INCOTERMS } from "@/lib/incoterms";

export type SupplierFormValues = {
  name?: string | null;
  country?: string | null;
  defaultIncoterm?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

export default function SupplierForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  defaultValues?: SupplierFormValues;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="sm:col-span-2">
          <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
            Nome do Fornecedor
          </label>
          <input
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
            placeholder="ex: Global Maritime Logistics Ltd."
            type="text"
            name="name"
            defaultValue={defaultValues?.name ?? ""}
            required
          />
        </div>
        <div>
          <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
            País
          </label>
          <input
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
            placeholder="ex: China"
            type="text"
            name="country"
            defaultValue={defaultValues?.country ?? ""}
          />
        </div>
        <div>
          <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
            Incoterm Padrão
          </label>
          <select
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all appearance-none"
            name="defaultIncoterm"
            defaultValue={defaultValues?.defaultIncoterm ?? ""}
          >
            <option value="">Selecione o Incoterm</option>
            {INCOTERMS.map((term) => (
              <option key={term} value={term}>
                {term}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="pt-6 border-t border-outline-variant">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="sm:col-span-2">
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              Pessoa de Contato
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
              placeholder="Nome completo"
              type="text"
              name="contactName"
              defaultValue={defaultValues?.contactName ?? ""}
            />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              E-mail
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
              placeholder="contato@fornecedor.com"
              type="email"
              name="email"
              defaultValue={defaultValues?.email ?? ""}
            />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              Telefone
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
              placeholder="+86 000 0000 0000"
              type="tel"
              name="phone"
              defaultValue={defaultValues?.phone ?? ""}
            />
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-outline-variant">
        <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
          Observações
        </label>
        <textarea
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all resize-none"
          placeholder="Requisitos específicos, condições combinadas, notas internas..."
          rows={5}
          name="notes"
          defaultValue={defaultValues?.notes ?? ""}
        />
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
