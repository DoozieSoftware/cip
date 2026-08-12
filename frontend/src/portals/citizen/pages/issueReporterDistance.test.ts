import { describe, expect, it } from 'vitest';
import { issueReporterDistanceMeters } from './issueReporterDistance';

describe('issueReporterDistanceMeters', () => {
  it('returns zero for the same point', () => {
    expect(issueReporterDistanceMeters(12.9716, 77.5946, 12.9716, 77.5946)).toBe(0);
  });

  it('calculates a meaningful distance for a separate issue pin', () => {
    expect(issueReporterDistanceMeters(12.9716, 77.5946, 12.9816, 77.5946)).toBeGreaterThan(1000);
  });
});
