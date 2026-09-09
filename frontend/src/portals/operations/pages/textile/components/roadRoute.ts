/**
 * Road-following route geometry via the public OSRM demo server.
 *
 * No API key and no billing; the driver still gets turn-by-turn through the
 * per-pin "Navigate" links that open the phone's maps app. OSRM is a
 * best-effort enhancement: every caller must fall back to straight
 * connectors when this returns null (offline, rate-limited, or too many
 * waypoints for one GET request).
 */

export type LatLng = [number, number];

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

/** OSRM caps waypoints per request; longer runs fall back to straight lines. */
const MAX_WAYPOINTS = 25;

export function buildOsrmUrl(points: LatLng[]): string {
  const coords = points.map(([lat, lng]) => `${lng},${lat}`).join(';');
  return `${OSRM_BASE}/${coords}?overview=full&geometries=geojson`;
}

/**
 * Fetch one road-following path through `points` in order.
 * Returns null on any failure — callers draw straight lines instead.
 */
export async function fetchRoadRoute(
  points: LatLng[],
  signal?: AbortSignal,
): Promise<LatLng[] | null> {
  if (points.length < 2 || points.length > MAX_WAYPOINTS) return null;

  try {
    const res = await fetch(buildOsrmUrl(points), {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      code?: unknown;
      routes?: Array<{ geometry?: { coordinates?: unknown } }>;
    };
    if (payload.code !== 'Ok') return null;
    const coords = payload.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords)) return null;
    const path: LatLng[] = [];
    for (const pair of coords) {
      if (
        Array.isArray(pair) &&
        typeof pair[0] === 'number' &&
        typeof pair[1] === 'number' &&
        Number.isFinite(pair[0]) &&
        Number.isFinite(pair[1])
      ) {
        path.push([pair[1], pair[0]]);
      }
    }
    return path.length >= 2 ? path : null;
  } catch {
    return null;
  }
}
