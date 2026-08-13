export type ReportStatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const FALLBACK_LABELS: Record<string, string> = {
  ai: 'AI',
};

function titleCaseStatus(code: string | null | undefined): string {
  if (!code) return '—';

  return code
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bAi\b/g, FALLBACK_LABELS.ai);
}

const CITIZEN_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Received',
  ai_processing: 'Received',
  pending_moderator: 'Received',
  assigned: 'Assigned to department',
  accepted: 'Assigned to department',
  in_progress: 'In progress',
  reopened: 'In progress',
  escalated: 'In progress',
  resolved: 'Fixed — please verify',
  resolved_pending_verification: 'Fixed — please verify',
  verified: 'Completed',
  closed: 'Completed',
  rejected: 'Could not accept',
  merged: 'Combined with another report',
};

const STAFF_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'New report',
  ai_processing: 'AI checking',
  pending_moderator: 'Needs review',
  assigned: 'Assigned',
  accepted: 'Accepted by officer',
  in_progress: 'Work in progress',
  resolved: 'Marked fixed',
  resolved_pending_verification: 'Waiting for citizen confirmation',
  reopened: 'Reopened by citizen',
  verified: 'Citizen confirmed',
  closed: 'Closed',
  rejected: 'Rejected',
  merged: 'Merged duplicate',
  escalated: 'Escalated',
};

export function citizenReportStatusLabel(code: string | null | undefined): string {
  return code ? (CITIZEN_STATUS_LABELS[code] ?? titleCaseStatus(code)) : '—';
}

export function staffReportStatusLabel(code: string | null | undefined): string {
  return code ? (STAFF_STATUS_LABELS[code] ?? titleCaseStatus(code)) : '—';
}

export function reportStatusTone(code: string | null | undefined): ReportStatusTone {
  switch (code) {
    case 'assigned':
    case 'accepted':
    case 'in_progress':
    case 'reopened':
      return 'info';
    case 'resolved':
    case 'verified':
      return 'success';
    case 'resolved_pending_verification':
    case 'submitted':
    case 'pending_moderator':
    case 'ai_processing':
      return 'warning';
    case 'rejected':
    case 'merged':
      return 'danger';
    case 'escalated':
      return 'danger';
    default:
      return 'neutral';
  }
}

export const STAFF_STATUS_FILTER_OPTIONS = [
  { value: 'submitted', label: STAFF_STATUS_LABELS.submitted },
  { value: 'ai_processing', label: STAFF_STATUS_LABELS.ai_processing },
  { value: 'pending_moderator', label: STAFF_STATUS_LABELS.pending_moderator },
  { value: 'assigned', label: STAFF_STATUS_LABELS.assigned },
  { value: 'accepted', label: STAFF_STATUS_LABELS.accepted },
  { value: 'in_progress', label: STAFF_STATUS_LABELS.in_progress },
  { value: 'resolved', label: STAFF_STATUS_LABELS.resolved },
  {
    value: 'resolved_pending_verification',
    label: STAFF_STATUS_LABELS.resolved_pending_verification,
  },
  { value: 'reopened', label: STAFF_STATUS_LABELS.reopened },
  { value: 'verified', label: STAFF_STATUS_LABELS.verified },
  { value: 'closed', label: STAFF_STATUS_LABELS.closed },
  { value: 'escalated', label: STAFF_STATUS_LABELS.escalated },
  { value: 'rejected', label: STAFF_STATUS_LABELS.rejected },
  { value: 'merged', label: STAFF_STATUS_LABELS.merged },
] as const;
