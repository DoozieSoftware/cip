/**
 * Client-side reverse geocoding for the citizen portal.
 *
 * The backend does not store a human-readable address for a report
 * location (only lat/lng), so to show "which location" in text we
 * reverse-geocode the coordinates to a place name. We use the public
 * OpenStreetMap Nominatim endpoint; if it is unreachable, rate-limited,
 * or returns nothing, we fall back to a stable, readable coordinate
 * label so the UI never shows a blank location.
 */

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';

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
 * Reverse-geocode a coordinate into a short place description.
 *
 * Resolves even on failure (never throws) — returns a coordinate-based
 * fallback so callers can always render a label.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<ReverseGeocodeResult> {
  const fallback: ReverseGeocodeResult = { label: formatCoordinates(lat, lng), geocoded: false };

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fallback;

  try {
    const url = `${NOMINATIM_ENDPOINT}?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return fallback;

    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const label = buildLabel(data, lat, lng);
    return { label, geocoded: Boolean(label && label !== fallback.label) };
  } catch {
    return fallback;
  }
}

/**
 * Build a concise, citizen-friendly label from a Nominatim response.
 * Prefers a short "road, suburb, city" shape over the very long
 * display_name.
 */
function buildLabel(
  data: { display_name?: string; address?: Record<string, string> },
  lat: number,
  lng: number,
): string {
  const a = data.address ?? {};
  const parts = [
    a.road || a.pedestrian || a.cycleway || a.footway,
    a.suburb || a.neighbourhood || a.quarter || a.block,
    a.city || a.town || a.village || a.municipality || a.county,
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(', ');
  }
  if (data.display_name) {
    // Trim the very long OSM display_name to its first couple of segments.
    return data.display_name.split(',').slice(0, 2).join(',').trim();
  }
  return formatCoordinates(lat, lng);
}
