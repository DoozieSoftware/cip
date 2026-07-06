import { describe, expect, it } from 'vitest';
import { normalizeNotification } from './client';

describe('citizen notifications client', () => {
  it('maps inbox items from subject/metadata into the page shape', () => {
    const item = normalizeNotification({
      id: 'n-1',
      subject: 'Report assigned',
      body: 'Your report has been assigned.',
      channel: 'push',
      read_at: null,
      created_at: '2026-07-06T10:00:00Z',
      metadata: { report_id: 'rep-1' },
    });

    expect(item.title).toBe('Report assigned');
    expect(item.data).toEqual({ report_id: 'rep-1' });
  });
});
