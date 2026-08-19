import { describe, expect, it } from 'vitest';
import { canUseAnalyticsBeacon } from './analytics';

describe('canUseAnalyticsBeacon', () => {
  it('uses beacon only when the analytics endpoint shares the page origin', () => {
    expect(
      canUseAnalyticsBeacon('/api/v1/public/analytics/events', 'https://cip.dgisipl.com'),
    ).toBe(true);
    expect(
      canUseAnalyticsBeacon(
        'https://cip-api.dgisipl.com/api/v1/public/analytics/events',
        'https://cip.dgisipl.com',
      ),
    ).toBe(false);
  });
});
