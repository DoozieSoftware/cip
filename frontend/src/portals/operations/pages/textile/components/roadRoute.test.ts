import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildOsrmUrl, fetchRoadRoute } from './roadRoute';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildOsrmUrl', () => {
  it('orders coordinates as lng,lat for OSRM', () => {
    const url = buildOsrmUrl([
      [12.9716, 77.5946],
      [12.9352, 77.6245],
    ]);
    expect(url).toBe(
      'https://router.project-osrm.org/route/v1/driving/77.5946,12.9716;77.6245,12.9352?overview=full&geometries=geojson',
    );
  });
});

describe('fetchRoadRoute', () => {
  it('returns lat,lng path from a valid OSRM response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            code: 'Ok',
            routes: [
              {
                geometry: {
                  coordinates: [
                    [77.59, 12.97],
                    [77.6, 12.98],
                  ],
                },
              },
            ],
          }),
      }),
    );
    expect(
      await fetchRoadRoute([
        [12.97, 77.59],
        [12.98, 77.6],
      ]),
    ).toEqual([
      [12.97, 77.59],
      [12.98, 77.6],
    ]);
  });

  it('returns null when the route is unusable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ code: 'NoRoute' }) }),
    );
    expect(
      await fetchRoadRoute([
        [12.97, 77.59],
        [12.98, 77.6],
      ]),
    ).toBeNull();
  });

  it('returns null on network failure without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(
      await fetchRoadRoute([
        [12.97, 77.59],
        [12.98, 77.6],
      ]),
    ).toBeNull();
  });

  it('returns null for too few or too many waypoints without fetching', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    expect(await fetchRoadRoute([[12.97, 77.59]])).toBeNull();
    expect(
      await fetchRoadRoute(Array.from({ length: 30 }, () => [12.97, 77.59] as [number, number])),
    ).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});
