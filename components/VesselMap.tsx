"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { divIcon } from "leaflet";

// Ícone customizado (SVG inline) em vez do ícone padrão do Leaflet — o
// padrão referencia imagens por caminho relativo que o bundler do Next.js
// não resolve corretamente (bug conhecido do react-leaflet/Next.js).
const shipIcon = divIcon({
  html: `<div style="transform: translate(-50%, -50%); font-size: 24px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));">🚢</div>`,
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export default function VesselMap({
  lat,
  lon,
  name,
  speedKnots,
  heading,
  destination,
}: {
  lat: number;
  lon: number;
  name: string | null;
  speedKnots: number | null;
  heading: number | null;
  destination: string | null;
}) {
  return (
    <MapContainer
      center={[lat, lon]}
      zoom={5}
      scrollWheelZoom={false}
      style={{ height: 220, width: "100%", borderRadius: "0.5rem" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lon]} icon={shipIcon}>
        <Popup>
          <div style={{ fontSize: 12 }}>
            <strong>{name ?? "Navio"}</strong>
            <br />
            {speedKnots !== null && <>Velocidade: {speedKnots} nós</>}
            {speedKnots !== null && heading !== null && <br />}
            {heading !== null && <>Rumo: {heading}°</>}
            {destination && (
              <>
                <br />
                Destino: {destination}
              </>
            )}
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
