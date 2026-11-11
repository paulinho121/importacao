import { CURRENCIES } from "@/lib/currencies";
import { CP_STATUS_OPTIONS } from "@/lib/product-flow";

import SubmitButton from "@/components/SubmitButton";
const FIELD_INPUT =
  "w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all";
const FIELD_LABEL = "block font-label-md text-label-md text-on-surface-variant mb-2";

export type ProductFormValues = {
  sku?: string | null;
  manufacturerSku?: string | null;
  ncm?: string | null;
  description?: string | null;
  longDescription?: string | null;
  datasheetUrl?: string | null;
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
  publicConsultationDate?: string | null;
  cpStatus?: string | null;
  cpRequestedAt?: string | null;
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

export type ProductFormPhoto = { id: string; url: string };

export default function ProductForm({
  action,
  defaultValues,
  submitLabel,
  suppliers,
  photos = [],
}: {
  action: (formData: FormData) => void;
  defaultValues?: ProductFormValues;
  submitLabel: string;
  suppliers: { id: string; name: string }[];
  photos?: ProductFormPhoto[];
}) {
  return (
    <form action={action} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="sm:col-span-2">
          <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
            Nome do Produto
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
        <div className="sm:col-span-2">
          <label className={FIELD_LABEL}>Fotos do produto</label>
          {photos.length > 0 && (
            <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {photos.map((photo, i) => (
                <li key={photo.id} className="rounded-lg border border-outline-variant p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- foto pode vir de qualquer link externo */}
                  <img src={photo.url} alt={`Foto ${i + 1}`} className="aspect-square w-full rounded bg-white object-contain" loading="lazy" />
                  <label className="mt-2 flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <input type="radio" name="coverPhotoId" value={photo.id} defaultChecked={i === 0} />
                    Principal
                  </label>
                  <label className="mt-1 flex items-center gap-1.5 text-xs text-error">
                    <input type="checkbox" name="removePhotoId" value={photo.id} className="rounded border-outline-variant" />
                    Remover
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2">
            <input
              type="file"
              name="photoFile"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-surface-container-high file:text-on-surface-variant"
            />
            <textarea
              className={FIELD_INPUT}
              name="photoLinks"
              rows={2}
              placeholder="…ou cole links de imagens (https://…), um por linha"
            />
            <p className="text-xs text-on-surface-variant">
              Pode adicionar várias fotos: PNG, JPEG ou WebP, até 4 MB no total por envio — ou links. A foto marcada como
              &quot;Principal&quot; aparece nas listas.
            </p>
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
            Descrição do Produto
          </label>
          <textarea
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
            placeholder="Descrição detalhada do produto (opcional)"
            name="longDescription"
            rows={4}
            defaultValue={defaultValues?.longDescription ?? ""}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block font-label-md text-label-md text-on-surface-variant mb-2">
            Ficha técnica (link)
          </label>
          <div className="flex items-center gap-2">
            <input
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-md font-body-md focus:outline-none focus:border-secondary transition-all"
              placeholder="Cole o link da ficha técnica (Google Drive ou site do fabricante)"
              type="url"
              name="datasheetUrl"
              defaultValue={defaultValues?.datasheetUrl ?? ""}
            />
            {defaultValues?.datasheetUrl && (
              <a
                href={defaultValues.datasheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 px-4 py-3 rounded-lg bg-secondary text-white text-sm font-bold hover:opacity-90 transition-all"
              >
                Abrir ficha
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-outline-variant">
        <h3 className="font-headline-sm text-headline-sm text-primary mb-1">Consulta Pública (CP)</h3>
        <p className="text-xs text-on-surface-variant mb-4">
          Confira se o item já tem consulta pública (a varredura da lista do governo em Produtos faz isso). Se não
          tiver, solicite e acompanhe por aqui.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className={FIELD_LABEL}>Situação da CP</label>
            <select
              className={`${FIELD_INPUT} appearance-none`}
              name="cpStatus"
              defaultValue={defaultValues?.cpStatus ?? ""}
            >
              <option value="">Ainda não verificado</option>
              {CP_STATUS_OPTIONS.filter((o) => o.value !== "NAO_VERIFICADO").map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={FIELD_LABEL}>Ref. Consulta Pública</label>
            <input
              className={FIELD_INPUT}
              placeholder="ex: Consulta Pública nº 17/21"
              type="text"
              name="publicConsultationRef"
              defaultValue={defaultValues?.publicConsultationRef ?? ""}
            />
          </div>
          <div>
            <label className={FIELD_LABEL}>Data da solicitação da CP</label>
            <input
              className={FIELD_INPUT}
              type="date"
              name="cpRequestedAt"
              defaultValue={defaultValues?.cpRequestedAt ?? ""}
            />
          </div>
          <div>
            <label className={FIELD_LABEL}>Data da CP (resultado)</label>
            <input
              className={FIELD_INPUT}
              type="date"
              name="publicConsultationDate"
              defaultValue={defaultValues?.publicConsultationDate ?? ""}
            />
          </div>
        </div>
      </div>

      {/* Ocultos por enquanto: continuam no formulário (só escondidos) pra os
          valores já cadastrados não serem apagados ao salvar o produto. */}
      <div className="hidden pt-6 border-t border-outline-variant" aria-hidden>
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

      <div className="hidden pt-6 border-t border-outline-variant" aria-hidden>
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

      <div className="flex items-center justify-between gap-4 pt-6 border-t border-outline-variant">
        <label className="flex items-center gap-2 text-body-sm font-body-sm text-on-surface-variant">
          <input
            type="checkbox"
            name="active"
            defaultChecked={defaultValues?.active ?? true}
            className="rounded border-outline-variant"
          />
          Ativo
        </label>
        <SubmitButton
          className="px-8 py-3 rounded-lg bg-secondary text-white font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all"
        >
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
