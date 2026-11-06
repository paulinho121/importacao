import { updateShipmentInfo } from "@/app/processos/actions";
import { formatDate } from "@/lib/status";

import SubmitButton from "@/components/SubmitButton";
const INPUT_CLASS =
  "w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all";

export type ShipmentInfo = {
  externalReference: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  closedAt: string | null;
  customsDeclarationNumber: string | null;
};

export default function ProcessShipmentInfo({
  processId,
  shipment,
}: {
  processId: string;
  shipment: ShipmentInfo;
}) {
  const boundUpdate = updateShipmentInfo.bind(null, processId);

  return (
    <section className="bg-surface-container-lowest border border-outline-variant p-gutter rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-stack-md gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">local_shipping</span>
          <h3 className="font-headline-sm text-headline-sm text-primary">Dados do Embarque</h3>
        </div>
        {shipment.trackingUrl && (
          <a
            href={shipment.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-secondary hover:underline font-label-md text-label-md"
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            Abrir rastreio
          </a>
        )}
      </div>

      <form action={boundUpdate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block font-label-md text-label-md text-on-surface-variant mb-1">
            Referência do agente
          </label>
          <input
            className={`${INPUT_CLASS} font-mono-data`}
            type="text"
            name="externalReference"
            defaultValue={shipment.externalReference ?? ""}
            placeholder="Ex: NSLIM2238/26"
          />
        </div>
        <div>
          <label className="block font-label-md text-label-md text-on-surface-variant mb-1">
            Nº de rastreio (B/L, AWB ou courier)
          </label>
          <input
            className={`${INPUT_CLASS} font-mono-data`}
            type="text"
            name="trackingNumber"
            defaultValue={shipment.trackingNumber ?? ""}
            placeholder="Ex: 176-65270752"
          />
        </div>
        <div>
          <label className="block font-label-md text-label-md text-on-surface-variant mb-1">
            Link de rastreio
          </label>
          <input
            className={INPUT_CLASS}
            type="url"
            name="trackingUrl"
            defaultValue={shipment.trackingUrl ?? ""}
            placeholder="https://..."
          />
        </div>
        <div>
          <label className="block font-label-md text-label-md text-on-surface-variant mb-1">
            Nº da DUIMP / DI
          </label>
          <input
            className={`${INPUT_CLASS} font-mono-data`}
            type="text"
            name="customsDeclarationNumber"
            defaultValue={shipment.customsDeclarationNumber ?? ""}
            placeholder="Ex: 26BR0001759081"
          />
        </div>
        <div>
          <label className="block font-label-md text-label-md text-on-surface-variant mb-1">
            Fechamento
            {shipment.closedAt ? (
              <span className="ml-2 text-xs text-outline">({formatDate(shipment.closedAt)})</span>
            ) : null}
          </label>
          <input className={INPUT_CLASS} type="date" name="closedAt" defaultValue={shipment.closedAt ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <SubmitButton
            className="px-5 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all"
          >
            Salvar dados do embarque
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}
