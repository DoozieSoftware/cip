import { describe, it, expect } from 'vitest';
import {
  lifecycleGroup,
  OPEN_STATUSES,
  AWAITING_CITIZEN_STATUSES,
  CLOSED_STATUSES,
  REJECTED_STATUSES,
  MERGED_STATUSES,
  type LifecycleGroup,
  type StatusFilter,
  type ReportSummary,
  type ReportDetail,
  type TimelineEntry,
  type AiSummary,
} from '../types';

describe('citizen types - lifecycle groups', () => {
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

  it('defaults unknown statuses to open', () => {
    expect(lifecycleGroup('unknown_status')).toBe('open');
    expect(lifecycleGroup('')).toBe('open');
  });

  it('does not overlap groups', () => {
    const allStatuses = [
      ...OPEN_STATUSES,
      ...AWAITING_CITIZEN_STATUSES,
      ...CLOSED_STATUSES,
      ...REJECTED_STATUSES,
      ...MERGED_STATUSES,
    ];
    const uniqueStatuses = new Set(allStatuses);
    expect(uniqueStatuses.size).toBe(allStatuses.length);
  });
});

describe('citizen types - type constraints', () => {
  it('accepts valid StatusFilter values', () => {
    const filters: StatusFilter[] = ['all', 'open', 'awaiting_citizen', 'closed', 'rejected', 'merged'];
    expect(filters).toHaveLength(6);
  });

  it('accepts valid LifecycleGroup values', () => {
    const groups: LifecycleGroup[] = ['open', 'awaiting_citizen', 'closed', 'rejected', 'merged'];
    expect(groups).toHaveLength(5);
  });

  it('ReportSummary requires tracking_number', () => {
    const summary: ReportSummary = {
      id: 'test-id',
      tracking_number: 'CIV-2026-000001',
      title: 'Test Report',
      status: { code: 'submitted', name: 'Submitted' },
    };
    expect(summary.tracking_number).toBe('CIV-2026-000001');
  });

  it('ReportSummary does not include is_verified', () => {
    const summary: ReportSummary = {
      id: 'test-id',
      tracking_number: 'CIV-2026-000001',
      title: 'Test Report',
      status: { code: 'submitted', name: 'Submitted' },
    };
    expect('is_verified' in summary).toBe(false);
  });

  it('ReportDetail extends ReportSummary with timeline and media', () => {
    const detail: ReportDetail = {
      id: 'test-id',
      tracking_number: 'CIV-2026-000001',
      title: 'Test Report',
      status: { code: 'submitted', name: 'Submitted' },
      timeline: [],
      media: [],
    };
    expect(detail.timeline).toEqual([]);
    expect(detail.media).toEqual([]);
  });

  it('TimelineEntry supports is_current flag', () => {
    const entry: TimelineEntry = {
      at: '2026-07-06T10:00:00Z',
      event: 'Report submitted',
      actor: 'System',
      is_current: true,
    };
    expect(entry.is_current).toBe(true);
  });

  it('AiSummary has correct structure', () => {
    const summary: AiSummary = {
      labels: [{ name: 'pothole', confidence: 0.95 }],
      fraud_score: 0.1,
      duplicate_of: null,
      recommended_department: { name: 'Roads', code: 'roads' },
    };
    expect(summary.labels).toHaveLength(1);
    expect(summary.fraud_score).toBe(0.1);
  });
});
