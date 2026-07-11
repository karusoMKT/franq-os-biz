// Geocoding helper using OpenStreetMap Nominatim (free, no API key).
// Results are cached in localStorage to avoid hammering the API and to
// respect Nominatim's fair-use policy (1 req/s per app).

export type LatLng = { lat: number; lng: number };

const CACHE_KEY = "franqos:geocode:v1";
const ENDPOINT = "https://nominatim.openstreetmap.org/search";

function readCache(): Record<string, LatLng | null> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, LatLng | null>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota */
  }
}

function keyOf(city: string, state: string) {
  return `${city.trim().toLowerCase()}|${state.trim().toLowerCase()}|br`;
}

export async function geocodeCity(
  city: string | null | undefined,
  state: string | null | undefined,
): Promise<LatLng | null> {
  if (!city || !state) return null;
  const key = keyOf(city, state);
  const cache = readCache();
  if (key in cache) return cache[key];

  const q = `${city}, ${state}, Brasil`;
  const url = `${ENDPOINT}?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = json[0];
    const result: LatLng | null = first
      ? { lat: Number(first.lat), lng: Number(first.lon) }
      : null;
    cache[key] = result;
    writeCache(cache);
    return result;
  } catch {
    return null;
  }
}

/** Sequentially geocode a list, respecting Nominatim's ~1 req/s policy. */
export async function geocodeUnits<T extends { city: string | null; state: string | null }>(
  units: T[],
): Promise<Array<T & { coords: LatLng | null }>> {
  const out: Array<T & { coords: LatLng | null }> = [];
  for (const u of units) {
    const cache = readCache();
    const cached = u.city && u.state ? cache[keyOf(u.city, u.state)] : undefined;
    if (cached !== undefined) {
      out.push({ ...u, coords: cached });
      continue;
    }
    const coords = await geocodeCity(u.city, u.state);
    out.push({ ...u, coords });
    // throttle only for uncached lookups
    await new Promise((r) => setTimeout(r, 1100));
  }
  return out;
}
