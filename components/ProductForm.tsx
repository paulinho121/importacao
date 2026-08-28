import { CURRENCIES } from "@/lib/currencies";

const LICENSE_STATUS_OPTIONS = [
  { value: "", label: "Sem licença / não se aplica" },
  { value: "A_REGISTRAR", label: "A Registrar" },
  { value: "PARA_ANALISE", label: "Para Análise" },
  { value: "EM_CONSULTA_PUBLICA", label: "Em Consulta Pública" },
  { value: "EM_EXIGENCIA", label: "Em Exigência" },
  { value: "DEFERIDA", label: "Deferida" },
  { value: "CANCELADA_INDEFERIDA", label: "Cancelada / Indeferida" },
];

export type ProductFormValues = {
  sku?: string | null;
  manufacturerSku?: string | null;
  ncm?: string | null;
  description?: string | null;
  defaultSupplierId?: string | null;
  costPrice?: string | null;
  costCurrency?: string | null;
  markupPercent?: string | null;
  ncmAnterior?: string | null;
  manufacturerName?: string | null;
  exporterName?: string | null;
  licenseNumber?: string | null;
  licenseRegisteredAt?: string | null;
  licenseStatus?: string | null;
  publicConsultationRef?: string | null;
  licenseApprovedAt?: string | null;
  customsBrokerRef?: string | null;
  active?: boolean | null;
  taxRateII?: string | null;
  taxRateIPI?: string | null;
  taxRatePIS?: string | null;
  taxRateCOFINS?: string | null;
  taxRateICMS?: string | null;
  cartonPiecesPerCarton?: string | null;
  cartonLengthCm?: string | null;
  cartonWidthCm?: string | null;
  cartonHeightCm?: string | null;
  cartonWeightKg?: string | null;
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
            NCM Vigente
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

      <div className="pt-6 border-t border-outline-variant">
        <h3 className="font-headline-sm text-headline-sm text-primary mb-1">
          Preço de Compra e Markup
        </h3>
        <p className="text-xs text-on-surface-variant mb-4">
          O preço de compra é o custo de aquisição (ex: preço de tabela do fornecedor). O
          preço de venda sugerido é calculado a partir do markup, nunca gravado diretamente.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              Preço de Compra
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md font-mono-data focus:outline-none focus:border-secondary transition-all"
              type="number"
              step="0.01"
              name="costPrice"
              defaultValue={defaultValues?.costPrice ?? ""}
            />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              Moeda
            </label>
            <select
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all appearance-none"
              name="costCurrency"
              defaultValue={defaultValues?.costCurrency ?? ""}
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              Markup (%)
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md font-mono-data focus:outline-none focus:border-secondary transition-all"
              type="number"
              step="0.01"
              name="markupPercent"
              defaultValue={defaultValues?.markupPercent ?? ""}
            />
          </div>
        </div>
        {defaultValues?.costPrice && defaultValues?.markupPercent && (
          <p className="mt-3 text-body-sm font-body-sm text-on-surface-variant">
            Preço de venda sugerido:{" "}
            <span className="font-bold text-primary font-mono-data">
              {(
                Number(defaultValues.costPrice) *
                (1 + Number(defaultValues.markupPercent) / 100)
              ).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
              {defaultValues.costCurrency ?? ""}
            </span>{" "}
            <span className="text-xs">(recalculado após salvar)</span>
          </p>
        )}
      </div>

      <div className="pt-6 border-t border-outline-variant">
        <h3 className="font-headline-sm text-headline-sm text-primary mb-1">Tributos (NCM)</h3>
        <p className="text-xs text-on-surface-variant mb-4">
          Alíquotas de importação cadastradas manualmente (sem integração com a tabela TEC) — usadas
          pra calcular o custo pousado do produto. Percentuais, ex: 12.5 = 12,5%.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">II (%)</label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md font-mono-data focus:outline-none focus:border-secondary transition-all"
              type="number"
              step="0.001"
              name="taxRateII"
              defaultValue={defaultValues?.taxRateII ?? ""}
            />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">IPI (%)</label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md font-mono-data focus:outline-none focus:border-secondary transition-all"
              type="number"
              step="0.001"
              name="taxRateIPI"
              defaultValue={defaultValues?.taxRateIPI ?? ""}
            />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">PIS (%)</label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md font-mono-data focus:outline-none focus:border-secondary transition-all"
              type="number"
              step="0.001"
              name="taxRatePIS"
              defaultValue={defaultValues?.taxRatePIS ?? ""}
            />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">COFINS (%)</label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md font-mono-data focus:outline-none focus:border-secondary transition-all"
              type="number"
              step="0.001"
              name="taxRateCOFINS"
              defaultValue={defaultValues?.taxRateCOFINS ?? ""}
            />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">ICMS (%)</label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md font-mono-data focus:outline-none focus:border-secondary transition-all"
              type="number"
              step="0.001"
              name="taxRateICMS"
              defaultValue={defaultValues?.taxRateICMS ?? ""}
            />
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-outline-variant">
        <h3 className="font-headline-sm text-headline-sm text-primary mb-1">
          Especificações de Carton (Cubagem)
        </h3>
        <p className="text-xs text-on-surface-variant mb-4">
          Da &quot;Carton Specs&quot; da price list do fornecedor — base pra estimar cubagem (m³) e
          quantos containers um Pedido de Compra vai precisar.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              Peças/Carton
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md font-mono-data focus:outline-none focus:border-secondary transition-all"
              type="number"
              step="1"
              min="1"
              name="cartonPiecesPerCarton"
              defaultValue={defaultValues?.cartonPiecesPerCarton ?? ""}
            />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              Comprimento (cm)
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md font-mono-data focus:outline-none focus:border-secondary transition-all"
              type="number"
              step="0.01"
              name="cartonLengthCm"
              defaultValue={defaultValues?.cartonLengthCm ?? ""}
            />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              Largura (cm)
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md font-mono-data focus:outline-none focus:border-secondary transition-all"
              type="number"
              step="0.01"
              name="cartonWidthCm"
              defaultValue={defaultValues?.cartonWidthCm ?? ""}
            />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              Altura (cm)
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md font-mono-data focus:outline-none focus:border-secondary transition-all"
              type="number"
              step="0.01"
              name="cartonHeightCm"
              defaultValue={defaultValues?.cartonHeightCm ?? ""}
            />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              Peso bruto (kg)
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md font-mono-data focus:outline-none focus:border-secondary transition-all"
              type="number"
              step="0.01"
              name="cartonWeightKg"
              defaultValue={defaultValues?.cartonWeightKg ?? ""}
            />
          </div>
        </div>
        {defaultValues?.cartonLengthCm && defaultValues?.cartonWidthCm && defaultValues?.cartonHeightCm && (
          <p className="mt-3 text-body-sm font-body-sm text-on-surface-variant">
            Cubagem por carton:{" "}
            <span className="font-bold text-primary font-mono-data">
              {(
                (Number(defaultValues.cartonLengthCm) *
                  Number(defaultValues.cartonWidthCm) *
                  Number(defaultValues.cartonHeightCm)) /
                1_000_000
              ).toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}{" "}
              m³
            </span>{" "}
            <span className="text-xs">(recalculado após salvar)</span>
          </p>
        )}
      </div>

      <div className="pt-6 border-t border-outline-variant">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline-sm text-headline-sm text-primary">
            Licenciamento de Importação (Inciso V)
          </h3>
          <label className="flex items-center gap-2 text-body-sm font-body-sm text-on-surface-variant">
            <input
              type="checkbox"
              name="active"
              defaultChecked={defaultValues?.active ?? true}
              className="rounded border-outline-variant"
            />
            Ativo
          </label>
        </div>
        <p className="text-xs text-on-surface-variant mb-4">
          Preencha só se este produto exigir licença de importação (LI) — nem todo produto
          precisa.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              NCM Anterior
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md font-mono-data focus:outline-none focus:border-secondary transition-all"
              placeholder="ex: 8507.60.00"
              type="text"
              name="ncmAnterior"
              maxLength={12}
              defaultValue={defaultValues?.ncmAnterior ?? ""}
            />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              Status da Licença
            </label>
            <select
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all appearance-none"
              name="licenseStatus"
              defaultValue={defaultValues?.licenseStatus ?? ""}
            >
              {LICENSE_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              Fabricante
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
              placeholder="Nome do fabricante"
              type="text"
              name="manufacturerName"
              defaultValue={defaultValues?.manufacturerName ?? ""}
            />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              Exportador
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
              placeholder="Nome do exportador"
              type="text"
              name="exporterName"
              defaultValue={defaultValues?.exporterName ?? ""}
            />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              Número da Licença
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md font-mono-data focus:outline-none focus:border-secondary transition-all"
              type="text"
              name="licenseNumber"
              defaultValue={defaultValues?.licenseNumber ?? ""}
            />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              Data de Registro
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
              type="date"
              name="licenseRegisteredAt"
              defaultValue={defaultValues?.licenseRegisteredAt ?? ""}
            />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              Ref. Consulta Pública
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
              placeholder="ex: Consulta Pública nº 17/21"
              type="text"
              name="publicConsultationRef"
              defaultValue={defaultValues?.publicConsultationRef ?? ""}
            />
          </div>
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              Data de Deferimento
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
              type="date"
              name="licenseApprovedAt"
              defaultValue={defaultValues?.licenseApprovedAt ?? ""}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
              Ref. Despachante
            </label>
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
              type="text"
              name="customsBrokerRef"
              defaultValue={defaultValues?.customsBrokerRef ?? ""}
            />
          </div>
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
