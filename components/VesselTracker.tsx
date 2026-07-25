"use client";

import { useActionState, useState } from "react";
import dynamic from "next/dynamic";
import { updateVesselInfo, refreshVesselPosition, type VesselActionState } from "@/app/processos/actions";

const VesselMap = dynamic(() => import("@/components/VesselMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[220px] w-full rounded-lg bg-surface-container-high animate-pulse" />
  ),
});

function minutesAgo(updatedAt: string): string {
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.round(minutes / 60);
  return `${hours}h atrás`;
}

export type VesselInfo = {
  vesselName: string | null;
  vesselImo: string | null;
  vesselMmsi: string | null;
  vesselLat: string | null;
  vesselLon: string | null;
  vesselSpeedKnots: string | null;
  vesselHeading: number | null;
  vesselDestination: string | null;
  vesselPositionUpdatedAt: string | null;
};

export default function VesselTracker({
  processId,
  vessel,
}: {
  processId: string;
  vessel: VesselInfo;
}) {
  const [editing, setEditing] = useState(!vessel.vesselImo && !vessel.vesselMmsi);
  const boundUpdateInfo = updateVesselInfo.bind(null, processId);
  const boundRefresh = refreshVesselPosition.bind(null, processId);
  const [state, refreshAction, isPending] = useActionState<VesselActionState, FormData>(
    boundRefresh,
    null,
  );

  const hasIdentifier = Boolean(vessel.vesselImo || vessel.vesselMmsi);
  const hasPosition = Boolean(vessel.vesselLat && vessel.vesselLon);

  return (
    <section className="bg-white border border-outline-variant p-gutter rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-stack-md">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">directions_boat</span>
          <h3 className="font-headline-sm text-headline-sm text-primary">Rastreamento do Navio</h3>
        </div>
        {hasIdentifier && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="text-xs text-secondary hover:underline"
          >
            {editing ? "Cancelar" : "Editar"}
          </button>
        )}
      </div>

      {editing ? (
        <form
          action={async (formData) => {
            await boundUpdateInfo(formData);
            setEditing(false);
          }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          <input
            className="bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm focus:outline-none focus:border-secondary transition-all"
            placeholder="Nome do navio"
            type="text"
            name="vesselName"
            defaultValue={vessel.vesselName ?? ""}
          />
          <input
            className="bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm font-mono-data focus:outline-none focus:border-secondary transition-all"
            placeholder="IMO"
            type="text"
            name="vesselImo"
            defaultValue={vessel.vesselImo ?? ""}
          />
          <input
            className="bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-body-sm font-body-sm font-mono-data focus:outline-none focus:border-secondary transition-all"
            placeholder="MMSI"
            type="text"
            name="vesselMmsi"
            defaultValue={vessel.vesselMmsi ?? ""}
          />
          <button
            type="submit"
            className="sm:col-span-3 px-4 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all"
          >
            Salvar
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-body-sm font-body-sm text-on-surface-variant">
            {vessel.vesselName ?? "Navio sem nome cadastrado"}
            {vessel.vesselImo ? ` · IMO ${vessel.vesselImo}` : ""}
            {vessel.vesselMmsi ? ` · MMSI ${vessel.vesselMmsi}` : ""}
          </p>

          {hasPosition && (
            <VesselMap
              lat={Number(vessel.vesselLat)}
              lon={Number(vessel.vesselLon)}
              name={vessel.vesselName}
              speedKnots={vessel.vesselSpeedKnots ? Number(vessel.vesselSpeedKnots) : null}
              heading={vessel.vesselHeading}
              destination={vessel.vesselDestination}
            />
          )}

          {hasPosition && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <span className="font-label-md text-label-md text-outline block">Velocidade</span>
                <span className="text-body-sm font-body-sm text-on-surface font-bold">
                  {vessel.vesselSpeedKnots ? `${vessel.vesselSpeedKnots} nós` : "—"}
                </span>
              </div>
              <div>
                <span className="font-label-md text-label-md text-outline block">Rumo</span>
                <span className="text-body-sm font-body-sm text-on-surface font-bold">
                  {vessel.vesselHeading !== null ? `${vessel.vesselHeading}°` : "—"}
                </span>
              </div>
              <div>
                <span className="font-label-md text-label-md text-outline block">Destino</span>
                <span className="text-body-sm font-body-sm text-on-surface font-bold">
                  {vessel.vesselDestination ?? "—"}
                </span>
              </div>
            </div>
          )}

          {state?.error && (
            <p className="text-xs text-error font-medium bg-error-container/20 border border-error-container/50 rounded-lg p-2">
              {state.error}
            </p>
          )}

          <form action={refreshAction}>
            <button
              type="submit"
              disabled={isPending}
              className="w-full px-4 py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:opacity-90 transition-all disabled:opacity-60"
            >
              {isPending
                ? "Consultando..."
                : hasPosition
                  ? "Atualizar Posição"
                  : "Consultar Posição"}
            </button>
          </form>

          {vessel.vesselPositionUpdatedAt && (
            <p className="text-xs text-on-surface-variant text-center">
              Atualizado {minutesAgo(vessel.vesselPositionUpdatedAt)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
