import { describe, expect, it } from 'vitest';
import {
  buildTripRoute,
  findNextPendingSequence,
  isMappableStop,
  type RouteMapStop,
} from './tripRouteMapUtils';

function stop(overrides: Partial<RouteMapStop> & { id: string }): RouteMapStop {
  return {
    requester_name: `Customer ${overrides.id}`,
    pickup_address: `${overrides.id} Main St, Bengaluru`,
    status: 'scheduled',
    ...overrides,
  };
}

describe('tripRouteMapUtils', () => {
  it('orders pins and the connecting path by manifest order', () => {
    const route = buildTripRoute([
      stop({ id: 'c1', latitude: 12.9716, longitude: 77.5946 }),
      stop({ id: 'c2', latitude: 12.975, longitude: 77.6 }),
      stop({ id: 'c3', latitude: 12.98, longitude: 77.61 }),
    ]);

    expect(route.points.map((p) => p.stopId)).toEqual(['c1', 'c2', 'c3']);
    expect(route.points.map((p) => p.sequence)).toEqual([1, 2, 3]);
    expect(route.path).toEqual([
      [12.9716, 77.5946],
      [12.975, 77.6],
      [12.98, 77.61],
    ]);
    expect(route.mappedCount).toBe(3);
    expect(route.totalCount).toBe(3);
    expect(route.unmapped).toEqual([]);
  });

  it('highlights the first pending stop as next and tones the rest by status', () => {
    const route = buildTripRoute([
      stop({ id: 'c1', status: 'picked_up', latitude: 12.9716, longitude: 77.5946 }),
      stop({ id: 'c2', status: 'scheduled', latitude: 12.975, longitude: 77.6 }),
      stop({ id: 'c3', status: 'missed', latitude: 12.98, longitude: 77.61 }),
      stop({ id: 'c4', status: 'scheduled', latitude: 12.99, longitude: 77.62 }),
    ]);

    expect(route.nextSequence).toBe(2);
    expect(route.points.map((p) => p.tone)).toEqual(['done', 'next', 'missed', 'todo']);
    expect(route.points.filter((p) => p.isNext).map((p) => p.sequence)).toEqual([2]);
  });

  it('lists stops without usable coordinates beneath the map in sequence', () => {
    const route = buildTripRoute([
      stop({ id: 'c1', latitude: 12.9716, longitude: 77.5946 }),
      stop({ id: 'c2' }),
      stop({ id: 'c3', latitude: null, longitude: null }),
      stop({ id: 'c4', latitude: Number.NaN, longitude: 77.6 }),
      stop({ id: 'c5', latitude: 12.98, longitude: 77.61 }),
    ]);

    expect(route.points.map((p) => p.sequence)).toEqual([1, 5]);
    expect(route.path).toEqual([
      [12.9716, 77.5946],
      [12.98, 77.61],
    ]);
    expect(route.unmapped.map((u) => [u.stopId, u.sequence])).toEqual([
      ['c2', 2],
      ['c3', 3],
      ['c4', 4],
    ]);
    // Next pending skips nothing: first manifest stop still pending.
    expect(route.nextSequence).toBe(1);
  });

  it('returns no next stop and a null centre when nothing is pending or mapped', () => {
    const done = buildTripRoute([
      stop({ id: 'c1', status: 'picked_up', latitude: 12.9716, longitude: 77.5946 }),
      stop({ id: 'c2', status: 'missed', latitude: 12.975, longitude: 77.6 }),
    ]);
    expect(done.nextSequence).toBeNull();
    expect(done.points.every((p) => !p.isNext)).toBe(true);

    const empty = buildTripRoute([]);
    expect(empty.center).toBeNull();
    expect(empty.mappedCount).toBe(0);

    const unmappedOnly = buildTripRoute([stop({ id: 'c1' })]);
    expect(unmappedOnly.center).toBeNull();
    expect(unmappedOnly.path).toEqual([]);
    expect(unmappedOnly.unmapped).toHaveLength(1);
  });

  it('centres the map on the mean of mapped stops', () => {
    const route = buildTripRoute([
      stop({ id: 'c1', latitude: 12.0, longitude: 77.0 }),
      stop({ id: 'c2', latitude: 14.0, longitude: 79.0 }),
    ]);
    expect(route.center).toEqual([13.0, 78.0]);
  });

  it('findNextPendingSequence uses manifest order, not coordinate order', () => {
    expect(
      findNextPendingSequence([
        stop({ id: 'c1', status: 'picked_up' }),
        stop({ id: 'c2', status: 'missed' }),
        stop({ id: 'c3', status: 'scheduled' }),
      ]),
    ).toBe(3);
    expect(findNextPendingSequence([stop({ id: 'c1', status: 'picked_up' })])).toBeNull();
  });

  it('isMappableStop rejects missing and non-finite coordinates', () => {
    expect(isMappableStop(stop({ id: 'a', latitude: 12.9, longitude: 77.5 }))).toBe(true);
    expect(isMappableStop(stop({ id: 'b' }))).toBe(false);
    expect(isMappableStop(stop({ id: 'c', latitude: null, longitude: 77.5 }))).toBe(false);
    expect(isMappableStop(stop({ id: 'd', latitude: Number.NaN, longitude: 77.5 }))).toBe(false);
    expect(
      isMappableStop(stop({ id: 'e', latitude: 12.9, longitude: Number.POSITIVE_INFINITY })),
    ).toBe(false);
  });
});
