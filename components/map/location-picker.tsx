"use client";

import dynamic from "next/dynamic";
import { Crosshair, Loader2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const LeafletMap = dynamic(() => import("@/components/map/leaflet-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

/** Picks an approximate home area for distance calculations (rounded to ~1 km on save). */
export function LocationPicker({
  value,
  onChange,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (value: { lat: number; lng: number } | null) => void;
}) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setError("Your browser can't share location. Tap the map instead.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: Math.round(position.coords.latitude * 100) / 100,
          lng: Math.round(position.coords.longitude * 100) / 100,
        };
        onChange(next);
        setFocus(next);
        setLocating(false);
      },
      () => {
        setError("Couldn't get your location. Tap the map to choose your area instead.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="h-64 overflow-hidden rounded-xl border">
        <LeafletMap
          center={value ?? { lat: 20.59, lng: 78.96 }}
          zoom={value ? 11 : 4}
          focus={focus}
          pins={
            value
              ? [
                  {
                    id: "home",
                    lat: value.lat,
                    lng: value.lng,
                    label: "Your approximate area",
                    tone: "draft",
                  },
                ]
              : []
          }
          onPick={(lat, lng) =>
            onChange({ lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 })
          }
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating}>
          {locating ? <Loader2 className="animate-spin" aria-hidden /> : <Crosshair aria-hidden />} Use my
          current area
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X aria-hidden /> Clear
          </Button>
        )}
      </div>
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        Tap roughly where you are — a neighbourhood is plenty. It&apos;s stored to ~1 km precision and only
        ever shown to others as a distance, never on a map.
      </p>
    </div>
  );
}
