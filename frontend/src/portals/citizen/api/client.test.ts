import { describe, expect, it } from 'vitest';
import { normalizeReport, shouldRefreshSubmittedReport, lifecycleGroup } from './client';

describe('citizen api client - report normalization', () => {
  it('maps backend report_type to the frontend type field and defaults missing collections', () => {
    const report = normalizeReport({
      id: 'rep-1',
      tracking_number: 'CIV-2026-000001',
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
      tracking_number: 'CIV-2026-000001',
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

describe('lifecycleGroup', () => {
  it('classifies open statuses correctly', () => {
    expect(lifecycleGroup('submitted')).toBe('open');
    expect(lifecycleGroup('ai_processing')).toBe('open');
    expect(lifecycleGroup('pending_moderator')).toBe('open');
    expect(lifecycleGroup('assigned')).toBe('open');
    expect(lifecycleGroup('accepted')).toBe('open');
    expect(lifecycleGroup('in_progress')).toBe('open');
    expect(lifecycleGroup('escalated')).toBe('open');
  });

  it('classifies awaiting_citizen statuses correctly', () => {
    expect(lifecycleGroup('resolved')).toBe('awaiting_citizen');
  });

  it('classifies closed statuses correctly', () => {
    expect(lifecycleGroup('closed')).toBe('closed');
    expect(lifecycleGroup('verified')).toBe('closed');
  });

  it('classifies rejected and merged separately', () => {
    expect(lifecycleGroup('rejected')).toBe('rejected');
    expect(lifecycleGroup('merged')).toBe('merged');
  });

  it('does not misclassify accepted as closed', () => {
    expect(lifecycleGroup('accepted')).not.toBe('closed');
    expect(lifecycleGroup('accepted')).toBe('open');
  });
});
