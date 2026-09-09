/**
 * Pure route-map helpers for the dispatch trip view.
 *
 * Kept free of Leaflet/DOM imports so pin ordering and path logic
 * stay unit-testable in isolation. Coordinates come from the
 * `latitude` / `longitude` fields the textile API already returns;
 * stops without usable coordinates are reported separately so the
 * caller can list them beneath the map in manifest order.
 */

export interface RouteMapStop {
  id: string;
  requester_name: string;
  pickup_address: string;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
}

export type RoutePinTone = 'next' | 'done' | 'missed' | 'todo';

export interface RouteMapPoint {
  stopId: string;
  /** 1-based manifest order — the number shown on the pin. */
  sequence: number;
  lat: number;
  lng: number;
  tone: RoutePinTone;
  isNext: boolean;
  requesterName: string;
  pickupAddress: string;
}

export interface UnmappedRouteStop {
  stopId: string;
  /** 1-based manifest order. */
  sequence: number;
  requesterName: string;
  pickupAddress: string;
}

export interface TripRoute {
  /** Mapped stops, in manifest order. */
  points: RouteMapPoint[];
  /** Polyline positions connecting mapped stops in manifest order. */
  path: Array<[number, number]>;
  /** Stops without usable coordinates, in manifest order. */
  unmapped: UnmappedRouteStop[];
  /** 1-based manifest sequence of the next pending stop, if any. */
  nextSequence: number | null;
  /** Mean centre of mapped stops; null when nothing is mappable. */
  center: [number, number] | null;
  mappedCount: number;
  totalCount: number;
}

/** Status value the dispatch board treats as "still to visit". */
export const PENDING_STOP_STATUS = 'scheduled';

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isMappableStop(stop: RouteMapStop): boolean {
  return isFiniteCoordinate(stop.latitude) && isFiniteCoordinate(stop.longitude);
}

/** 1-based manifest sequence of the first pending stop, or null when none remain. */
export function findNextPendingSequence(stops: readonly RouteMapStop[]): number | null {
  const idx = stops.findIndex((stop) => stop.status === PENDING_STOP_STATUS);
  return idx >= 0 ? idx + 1 : null;
}

function toneFor(status: string, isNext: boolean): RoutePinTone {
  if (status === 'picked_up') return 'done';
  if (status === 'missed') return 'missed';
  if (isNext) return 'next';
  return 'todo';
}

export function buildTripRoute(stops: readonly RouteMapStop[]): TripRoute {
  const nextSequence = findNextPendingSequence(stops);
  const points: RouteMapPoint[] = [];
  const unmapped: UnmappedRouteStop[] = [];

  stops.forEach((stop, idx) => {
    const sequence = idx + 1;
    if (isMappableStop(stop)) {
      const isNext = sequence === nextSequence;
      points.push({
        stopId: stop.id,
        sequence,
        lat: stop.latitude as number,
        lng: stop.longitude as number,
        tone: toneFor(stop.status, isNext),
        isNext,
        requesterName: stop.requester_name,
        pickupAddress: stop.pickup_address,
      });
    } else {
      unmapped.push({
        stopId: stop.id,
        sequence,
        requesterName: stop.requester_name,
        pickupAddress: stop.pickup_address,
      });
    }
  });

  const path = points.map((point): [number, number] => [point.lat, point.lng]);
  const center =
    points.length === 0
      ? null
      : ([
          points.reduce((sum, point) => sum + point.lat, 0) / points.length,
          points.reduce((sum, point) => sum + point.lng, 0) / points.length,
        ] as [number, number]);

  return {
    points,
    path,
    unmapped,
    nextSequence,
    center,
    mappedCount: points.length,
    totalCount: stops.length,
  };
}
