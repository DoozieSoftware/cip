import { describe, expect, it } from 'vitest';
import {
  citizenReportStatusLabel,
  reportStatusTone,
  staffReportStatusLabel,
} from './statusDisplay';

describe('status display labels', () => {
  it('collapses workflow statuses into citizen-friendly labels', () => {
    expect(citizenReportStatusLabel('submitted')).toBe('Received');
    expect(citizenReportStatusLabel('ai_processing')).toBe('Received');
    expect(citizenReportStatusLabel('pending_moderator')).toBe('Received');
    expect(citizenReportStatusLabel('assigned')).toBe('Assigned to department');
    expect(citizenReportStatusLabel('accepted')).toBe('Assigned to department');
    expect(citizenReportStatusLabel('resolved_pending_verification')).toBe('Fixed — please verify');
    expect(citizenReportStatusLabel('verified')).toBe('Completed');
    expect(citizenReportStatusLabel('closed')).toBe('Completed');
  });

  it('uses the same final status label across staff-facing surfaces', () => {
    expect(staffReportStatusLabel('pending_moderator')).toBe('Needs review');
    expect(staffReportStatusLabel('resolved')).toBe('Fixed — proof submitted');
    expect(staffReportStatusLabel('resolved_pending_verification')).toBe(
      'Waiting for citizen confirmation',
    );
    expect(staffReportStatusLabel('reopened')).toBe('Reopened by citizen');
    expect(staffReportStatusLabel('verified')).toBe('Completed');
    expect(staffReportStatusLabel('closed')).toBe('Completed');
  });

  it('groups tones consistently across staff surfaces', () => {
    expect(reportStatusTone('resolved_pending_verification')).toBe('warning');
    expect(reportStatusTone('reopened')).toBe('info');
    expect(reportStatusTone('merged')).toBe('danger');
    expect(reportStatusTone('verified')).toBe('success');
    expect(reportStatusTone('closed')).toBe('success');
  });
});
