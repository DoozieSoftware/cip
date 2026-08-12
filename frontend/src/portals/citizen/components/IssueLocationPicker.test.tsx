import { describe, expect, it } from 'vitest';
import { issueLocationFromPin, issueLocationFromReporter } from './issueLocation';

describe('issue location provenance', () => {
  it('starts from the reporter GPS fix without losing source metadata', () => {
    expect(
      issueLocationFromReporter({
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy_m: 12,
        captured_at: 1_700_000_000_000,
        mock_heuristic: { likely: false, score: 0, reasons: [] },
      }),
    ).toEqual({ latitude: 12.9716, longitude: 77.5946, source: 'reporter_gps' });
  });

  it('marks a map-selected issue pin as manual', () => {
    expect(issueLocationFromPin(12.972, 77.596)).toEqual({
      latitude: 12.972,
      longitude: 77.596,
      source: 'manual_pin',
    });
  });
});
