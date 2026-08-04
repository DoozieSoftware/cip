/**
 * Client-side reverse geocoding shared by the citizen and moderator
 * portals.
 *
 * The backend stores only lat/lng for a report location, so to show
 * "which location" in text we reverse-geocode the coordinates to a
 * place name. We use the OpenStreetMap road network through Overpass; if
 * it is unreachable or returns nothing, callers receive an empty label
 * rather than a raw coordinate pretending to be an address.
 */

const OVERPASS_ENDPOINT = 'https://overpass.kumi.systems/api/interpreter';
const resultCache = new Map<string, ReverseGeocodeResult>();

export function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export interface ReverseGeocodeResult {
  /** Best-effort human-readable place name. */
  label: string;
  /** True when the label came from a reverse-geocode lookup. */
  geocoded: boolean;
}

/**
 * Resolve a coordinate to its nearest named road.
 *
 * Resolves even on failure (never throws). A blank label means no usable
 * road/place text was found.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<ReverseGeocodeResult> {
  const fallback: ReverseGeocodeResult = { label: '', geocoded: false };

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fallback;

  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = resultCache.get(cacheKey);
  if (cached) return cached;

  try {
    const query = `[out:json][timeout:10];way(around:120,${lat},${lng})[highway][name];out tags center;`;
    const url = `${OVERPASS_ENDPOINT}?data=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return fallback;

    const data = (await res.json()) as OverpassResponse;
    const result = buildRoadLabel(data, lat, lng);
    resultCache.set(cacheKey, result);
    return result;
  } catch {
    return fallback;
  }
}

/**
 * Pick the closest named road from the nearby OpenStreetMap ways. The GPS
 * point remains the exact location; this label tells the officer which road
 * to look for without pretending that the road name is a house address.
 */
interface OverpassElement {
  center?: { lat?: number; lon?: number };
  tags?: { name?: string };
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

interface NamedRoad {
  center: { lat: number; lon: number };
  tags: { name: string };
}

function buildRoadLabel(data: OverpassResponse, lat: number, lng: number): ReverseGeocodeResult {
  const nearest = (data.elements ?? [])
    .filter(
      (element): element is NamedRoad =>
        typeof element.center?.lat === 'number' &&
        typeof element.center?.lon === 'number' &&
        typeof element.tags?.name === 'string' &&
        element.tags.name.trim().length > 0,
    )
    .sort(
      (a, b) =>
        distanceSquared(a.center.lat, a.center.lon, lat, lng) -
        distanceSquared(b.center.lat, b.center.lon, lat, lng),
    )[0];

  if (!nearest) return { label: '', geocoded: false };
  return { label: `${nearest.tags.name}, Bengaluru`, geocoded: true };
}

function distanceSquared(aLat: number, aLng: number, bLat: number, bLng: number): number {
  return (aLat - bLat) ** 2 + (aLng - bLng) ** 2;
}
