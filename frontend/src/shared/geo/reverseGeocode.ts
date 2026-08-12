/**
 * Client-side reverse geocoding shared by the citizen and moderator
 * portals.
 *
 * The backend stores only lat/lng for a report location, so to show
 * "which location" in text we reverse-geocode the coordinates to a
 * place name. The API proxies the configured geocoder; if it is
 * unreachable or returns nothing, callers receive an empty label
 * rather than a raw coordinate pretending to be an address.
 */

import { buildApiUrl } from '../api/client';
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
    const url = buildApiUrl(`/public/geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return fallback;

    const data = (await res.json()) as { label?: unknown; geocoded?: unknown };
    const result: ReverseGeocodeResult = {
      label: typeof data.label === 'string' ? data.label : '',
      geocoded: data.geocoded === true,
    };
    resultCache.set(cacheKey, result);
    return result;
  } catch {
    return fallback;
  }
}
