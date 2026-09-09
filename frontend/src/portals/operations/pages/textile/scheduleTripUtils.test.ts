import { describe, expect, it } from 'vitest';
import { suggestProximityOrder } from './scheduleTripUtils';

describe('suggestProximityOrder', () => {
  it('orders mapped collections nearest-first from the starting point', () => {
    const ordered = suggestProximityOrder(
      [
        { id: 'far', latitude: 12.98, longitude: 77.6 },
        { id: 'near', latitude: 12.91, longitude: 77.58 },
        { id: 'middle', latitude: 12.94, longitude: 77.59 },
      ],
      12.9,
      77.58,
    );

    expect(ordered).toEqual(['near', 'middle', 'far']);
  });

  it('chains each next-nearest stop instead of sorting by address text', () => {
    // Alphabetically "alpha-far" comes first, but it is geographically last.
    const ordered = suggestProximityOrder(
      [
        { id: 'alpha-far', latitude: 12.99, longitude: 77.62 },
        { id: 'zulu-near', latitude: 12.905, longitude: 77.581 },
        { id: 'mid', latitude: 12.92, longitude: 77.585 },
      ],
      12.9,
      77.58,
    );

    expect(ordered).toEqual(['zulu-near', 'mid', 'alpha-far']);
  });

  it('keeps collections without a location in input order at the end', () => {
    const ordered = suggestProximityOrder([
      { id: 'missing-a', latitude: null, longitude: null },
      { id: 'mapped', latitude: 12.91, longitude: 77.58 },
      { id: 'missing-b' },
    ]);

    expect(ordered).toEqual(['mapped', 'missing-a', 'missing-b']);
  });
});
