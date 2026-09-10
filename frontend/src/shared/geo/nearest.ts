/**
 * Nearest-point helpers for the citizen booking flow (issue #30).
 *
 * Pure functions: given a source coordinate, rank zones/centres by
 * great-circle distance so the form can preselect the nearest option.
 * Items without usable coordinates are skipped, never ranked.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineKm(from: LatLng, to: LatLng): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

function isUsable(coords: LatLng | null | undefined): coords is LatLng {
  return (
    coords !== null &&
    coords !== undefined &&
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude)
  );
}

/**
 * Return the closest item to `from`, or null when no item has usable
 * coordinates. Ties keep the first item in list order.
 */
export function nearestBy<T>(
  items: readonly T[],
  from: LatLng,
  coordsOf: (item: T) => LatLng | null | undefined,
): T | null {
  let best: T | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const item of items) {
    const coords = coordsOf(item);
    if (!isUsable(coords)) continue;
    const distance = haversineKm(from, coords);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = item;
    }
  }

  return best;
}
