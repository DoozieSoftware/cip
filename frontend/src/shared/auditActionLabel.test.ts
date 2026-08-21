import { describe, expect, it } from 'vitest';
import { auditActionLabel } from './auditActionLabel';

describe('auditActionLabel', () => {
  it('replaces internal audit event codes with staff-facing labels', () => {
    expect(auditActionLabel('workflow.transition')).toBe('Status updated');
    expect(auditActionLabel('report.department_action')).toBe('Department action recorded');
  });

  it('labels lifecycle events with complaint wording while keeping event codes', () => {
    expect(auditActionLabel('report.created')).toBe('Complaint created');
    expect(auditActionLabel('report.approved')).toBe('Complaint approved');
    expect(auditActionLabel('report.rejected')).toBe('Complaint rejected');
    expect(auditActionLabel('report.merged')).toBe('Complaints merged');
    expect(auditActionLabel('report.escalated')).toBe('Complaint escalated');
  });

  it('formats an unknown event code without exposing its raw separators', () => {
    expect(auditActionLabel('report.custom_follow_up')).toBe('Report Custom Follow Up');
  });
});
