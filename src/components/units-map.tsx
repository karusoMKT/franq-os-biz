import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Skeleton } from "@/components/ui/skeleton";
import { geocodeUnits, type LatLng } from "@/lib/geocode";

export type MapUnit = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  score: number | null;
  latitude?: number | null;
  longitude?: number | null;
};

type ResolvedUnit = MapUnit & { coords: LatLng | null };

function colorForScore(score: number | null): { color: string; label: string } {
  const s = Number(score ?? 0);
  if (s >= 80) return { color: "#16a34a", label: "Saudável" };
  if (s >= 50) return { color: "#eab308", label: "Atenção" };
  return { color: "#dc2626", label: "Crítico" };
}

function pinIcon(color: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="15" cy="15" r="5" fill="white"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "franqos-map-pin",
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -38],
  });
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 11);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
  }, [map, points]);
  return null;
}

export function UnitsMap({ units }: { units: MapUnit[] }) {
  const [resolved, setResolved] = useState<ResolvedUnit[] | null>(null);

  // Split: pre-known coords vs need geocoding
  const preResolved = useMemo<ResolvedUnit[]>(
    () =>
      units.map((u) => ({
        ...u,
        coords:
          u.latitude != null && u.longitude != null
            ? { lat: Number(u.latitude), lng: Number(u.longitude) }
            : null,
      })),
    [units],
  );

  useEffect(() => {
    let cancelled = false;
    const needGeocode = preResolved.filter((u) => !u.coords);
    if (!needGeocode.length) {
      setResolved(preResolved);
      return;
    }
    setResolved(preResolved); // show what we have; fill in as they come
    (async () => {
      const geocoded = await geocodeUnits(needGeocode);
      if (cancelled) return;
      const byId = new Map(geocoded.map((g) => [g.id, g.coords]));
      setResolved(
        preResolved.map((u) => (u.coords ? u : { ...u, coords: byId.get(u.id) ?? null })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [preResolved]);

  const list = resolved ?? preResolved;
  const pins = list.filter((u): u is ResolvedUnit & { coords: LatLng } => !!u.coords);

  if (!units.length) {
    return (
      <div className="h-64 rounded-lg bg-slate-100 flex items-center justify-center text-sm text-muted-foreground">
        Nenhuma unidade para exibir no mapa.
      </div>
    );
  }

  if (!pins.length) {
    return <Skeleton className="h-64 w-full rounded-lg" />;
  }

  return (
    <div className="h-64 rounded-lg overflow-hidden border z-0 isolate">
      <MapContainer
        center={[pins[0].coords.lat, pins[0].coords.lng]}
        zoom={4}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={pins.map((p) => p.coords)} />
        {pins.map((u) => {
          const { color, label } = colorForScore(u.score);
          return (
            <Marker key={u.id} position={[u.coords.lat, u.coords.lng]} icon={pinIcon(color)}>
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {u.city ?? "—"}
                    {u.state ? `, ${u.state}` : ""}
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: color }}
                    />
                    <span className="text-xs font-medium">
                      Score {u.score ?? "—"} · {label}
                    </span>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
