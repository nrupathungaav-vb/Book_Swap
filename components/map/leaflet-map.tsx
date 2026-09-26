"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  tone: "agreed" | "suggested" | "draft" | "declined";
}

const TONE_COLOR: Record<MapPin["tone"], string> = {
  agreed: "#2f5d46",
  suggested: "#d99a2b",
  draft: "#b4533a",
  declined: "#8a8a8a",
};

function pinIcon(tone: MapPin["tone"]) {
  // Inline SVG div-icon: avoids Leaflet's default image paths breaking under bundlers.
  const color = TONE_COLOR[tone];
  return L.divIcon({
    className: "",
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -36],
    html: `<svg width="30" height="40" viewBox="0 0 30 40" aria-hidden="true"><path d="M15 0C6.7 0 0 6.6 0 14.8 0 26 15 40 15 40s15-14 15-25.2C30 6.6 23.3 0 15 0z" fill="${color}" stroke="white" stroke-width="2"/><circle cx="15" cy="15" r="5.5" fill="white"/></svg>`,
  });
}

function ClickHandler({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick?.(Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6)));
    },
  });
  return null;
}

/** Leaflet can't size itself inside a hidden tab; re-measure whenever the container resizes. */
function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function Recenter({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), zoom), { animate: true });
  }, [lat, lng, zoom, map]);
  return null;
}

export default function LeafletMap({
  center,
  zoom = 13,
  pins,
  onPick,
  focus,
  className,
}: {
  center: { lat: number; lng: number };
  zoom?: number;
  pins: MapPin[];
  onPick?: (lat: number, lng: number) => void;
  focus?: { lat: number; lng: number } | null;
  className?: string;
}) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={zoom} scrollWheelZoom className={className} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onPick} />
      <InvalidateOnResize />
      {focus && <Recenter lat={focus.lat} lng={focus.lng} zoom={14} />}
      {pins.map((pin) => (
        <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={pinIcon(pin.tone)} title={pin.label} alt={pin.label}>
          <Popup>{pin.label}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
