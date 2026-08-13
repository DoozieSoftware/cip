import { afterEach, describe, expect, it, vi } from 'vitest';
import { reverseGeocode } from './reverseGeocode';

describe('reverseGeocode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the public API envelope shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                label: 'Doctor B R Ambedkar Veedhi, Bengaluru',
                geocoded: true,
              },
            }),
        }),
      ),
    );

    await expect(reverseGeocode(12.9753, 77.591)).resolves.toEqual({
      label: 'Doctor B R Ambedkar Veedhi, Bengaluru',
      geocoded: true,
    });
  });
});
