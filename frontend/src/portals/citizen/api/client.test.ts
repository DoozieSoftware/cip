import { describe, expect, it } from 'vitest';
import { normalizeReport } from './client';

describe('citizen api client - report normalization', () => {
  it('maps backend report_type to the frontend type field and defaults missing collections', () => {
    const report = normalizeReport({
      id: 'rep-1',
      title: 'Pothole on MG Road',
      description: 'Large pothole near the signal',
      status: { code: 'submitted', name: 'Submitted' },
      report_type: { code: 'pothole', name: 'Pothole' },
      priority: { code: 'medium', name: 'Medium' },
      created_at: '2026-07-06T10:00:00Z',
      updated_at: '2026-07-06T10:00:00Z',
      location: { latitude: 12.9716, longitude: 77.5946, address: 'MG Road' },
    });

    expect(report.type?.name).toBe('Pothole');
    expect(report.media).toEqual([]);
    expect(report.timeline).toEqual([]);
  });
});
