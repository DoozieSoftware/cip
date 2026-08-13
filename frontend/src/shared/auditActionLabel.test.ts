import { describe, expect, it } from 'vitest';
import { auditActionLabel } from './auditActionLabel';

describe('auditActionLabel', () => {
  it('replaces internal audit event codes with staff-facing labels', () => {
    expect(auditActionLabel('workflow.transition')).toBe('Status updated');
    expect(auditActionLabel('report.department_action')).toBe('Department action recorded');
  });

  it('formats an unknown event code without exposing its raw separators', () => {
    expect(auditActionLabel('report.custom_follow_up')).toBe('Report Custom Follow Up');
  });
});
