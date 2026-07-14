/**
 * Client-side reverse geocoding shared by the citizen and moderator
 * portals.
 *
 * The backend stores only lat/lng for a report location, so to show
 * "which location" in text we reverse-geocode the coordinates to a
 * place name. We use the public OpenStreetMap Nominatim endpoint; if it
 * is unreachable, rate-limited, or returns nothing, we fall back to a
 * stable, readable coordinate label so the UI never shows a blank
 * location.
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
 * Build a concise but street-level place label from a Nominatim
 * response. Prefers the most specific parts available — a named place
 * (building/amenity), the road (with house number), the neighbourhood,
 * then the wider area and city — e.g. "8th Cross Road, Kengeri Satellite
 * Town, Kengeri, Bengaluru". Falls back through the long display_name to
 * raw coordinates so a label is always produced.
 */
function buildLabel(
  data: { display_name?: string; address?: Record<string, string> },
  lat: number,
  lng: number,
): string {
  const a = data.address ?? {};
  const road = a.road || a.pedestrian || a.cycleway || a.footway || a.residential;
  const roadPart = road && a.house_number ? `${a.house_number} ${road}` : road;

  const parts = [
    a.amenity || a.building || a.shop || a.office || a.tourism,
    roadPart,
    a.neighbourhood || a.quarter || a.block || a.hamlet,
    a.suburb || a.village,
    a.city || a.town || a.municipality || a.city_district || a.county,
  ].filter((p): p is string => Boolean(p));

  // Drop duplicates (e.g. suburb === city_district) while keeping order.
  const seen = new Set<string>();
  const unique = parts.filter((p) => {
    const key = p.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length > 0) {
    return unique.slice(0, 4).join(', ');
  }
  if (data.display_name) {
    return data.display_name.split(',').slice(0, 3).join(',').trim();
  }
  return formatCoordinates(lat, lng);
}
