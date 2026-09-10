import { describe, expect, it } from 'vitest';
import { haversineKm, nearestBy, type LatLng } from './nearest';

const BENGALURU: LatLng = { latitude: 12.9716, longitude: 77.5946 };
const MYSURU: LatLng = { latitude: 12.2958, longitude: 76.6394 };

describe('haversineKm', () => {
  it('returns zero for identical points', () => {
    expect(haversineKm(BENGALURU, BENGALURU)).toBe(0);
  });

  it('approximates the Bengaluru–Mysuru distance', () => {
    expect(haversineKm(BENGALURU, MYSURU)).toBeGreaterThan(120);
    expect(haversineKm(BENGALURU, MYSURU)).toBeLessThan(160);
  });
});

describe('nearestBy', () => {
  it('returns null for an empty list', () => {
    expect(nearestBy([], BENGALURU, (x: LatLng) => x)).toBeNull();
  });

  it('picks the closest item', () => {
    const items = [
      { id: 'far', at: MYSURU },
      { id: 'near', at: { latitude: 12.975, longitude: 77.6 } },
    ];
    expect(nearestBy(items, BENGALURU, (i) => i.at)?.id).toBe('near');
  });

  it('skips items without usable coordinates', () => {
    const items = [
      { id: 'nocentre', at: null },
      { id: 'nan', at: { latitude: Number.NaN, longitude: 77.6 } },
      { id: 'ok', at: MYSURU },
    ];
    expect(nearestBy(items, BENGALURU, (i) => i.at)?.id).toBe('ok');
  });

  it('returns null when nothing has coordinates', () => {
    expect(nearestBy([{ id: 'x', at: null }], BENGALURU, (i) => i.at)).toBeNull();
  });

  it('keeps list order on a tie', () => {
    const items = [
      { id: 'first', at: BENGALURU },
      { id: 'second', at: BENGALURU },
    ];
    expect(nearestBy(items, BENGALURU, (i) => i.at)?.id).toBe('first');
  });
});
