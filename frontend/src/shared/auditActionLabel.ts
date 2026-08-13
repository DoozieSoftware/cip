const AUDIT_ACTION_LABELS: Record<string, string> = {
  'workflow.transition': 'Status updated',
  'report.department_action': 'Department action recorded',
  'report.department_progress': 'Department progress updated',
  'report.review': 'Moderator review completed',
  'report.approved': 'Report approved',
  'report.rejected': 'Report rejected',
  'report.merged': 'Reports merged',
  'report.escalated': 'Report escalated',
  'report.reassigned': 'Assignment updated',
  'report.created': 'Report created',
};

/** Turns internal audit event codes into language suitable for staff screens. */
export function auditActionLabel(action: string): string {
  const known = AUDIT_ACTION_LABELS[action];
  if (known) return known;

  return action
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
