import { describe, expect, it } from 'vitest';
import { normalizeReport, shouldRefreshSubmittedReport } from './client';

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

  it('keeps newly submitted reports refreshing until media/status catches up', () => {
    const submitted = normalizeReport({
      id: 'rep-1',
      title: 'Pothole on MG Road',
      status: { code: 'submitted', name: 'Submitted' },
      media_count: 1,
      media: [],
    });
    const mediaStillUploading = normalizeReport({
      ...submitted,
      status: { code: 'pending_moderator', name: 'Pending moderator' },
    });
    const ready = normalizeReport({
      ...mediaStillUploading,
      media: [{ id: 'photo-1', kind: 'photo', signed_url: 'https://example.test/photo.jpg' }],
    });

    expect(shouldRefreshSubmittedReport(undefined)).toBe(true);
    expect(shouldRefreshSubmittedReport(submitted)).toBe(true);
    expect(shouldRefreshSubmittedReport(mediaStillUploading)).toBe(true);
    expect(shouldRefreshSubmittedReport(ready)).toBe(false);
  });
});
