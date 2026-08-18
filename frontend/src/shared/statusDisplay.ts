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
  resolved: 'Fixed — proof submitted',
  resolved_pending_verification: 'Waiting for citizen confirmation',
  reopened: 'Reopened by citizen',
  // `verified` is the internal transition written after citizen validation.
  // It is already the terminal positive outcome, so every portal displays it
  // with the same user-facing label as the alternate `closed` path.
  verified: 'Completed',
  closed: 'Completed',
  rejected: 'Rejected',
  merged: 'Merged duplicate',
  escalated: 'Escalated',
};

// Plain-language "what this means" line per docs/mom-product-decisions.md
// §2 (Meaning column), phrased for the citizen reading their own report.
const CITIZEN_STATUS_MEANING: Record<string, string> = {
  draft: 'Your report is saved but not yet submitted.',
  submitted:
    "Your report has been received and is being checked before it's sent to the right department.",
  ai_processing:
    "Your report has been received and is being checked before it's sent to the right department.",
  pending_moderator:
    "Your report has been received and is being checked before it's sent to the right department.",
  assigned: 'A department has been notified and will act on your report.',
  accepted: 'A department has been notified and will act on your report.',
  in_progress: 'Work on your report is underway.',
  reopened: 'Work on your report is underway.',
  escalated: 'Work on your report is underway.',
  resolved: 'The department says this has been fixed. Please confirm below.',
  resolved_pending_verification: 'The department says this has been fixed. Please confirm below.',
  verified: 'This report has been resolved and confirmed.',
  closed: 'This report has been resolved and confirmed.',
  rejected: 'This report could not be acted on by the platform.',
  merged: 'This report is being tracked together with another report of the same issue.',
};

export function citizenReportStatusLabel(code: string | null | undefined): string {
  return code ? (CITIZEN_STATUS_LABELS[code] ?? titleCaseStatus(code)) : '—';
}

export function citizenReportStatusMeaning(code: string | null | undefined): string | null {
  return code ? (CITIZEN_STATUS_MEANING[code] ?? null) : null;
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
    case 'closed':
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
  { value: 'verified,closed', label: STAFF_STATUS_LABELS.verified },
  { value: 'escalated', label: STAFF_STATUS_LABELS.escalated },
  { value: 'rejected', label: STAFF_STATUS_LABELS.rejected },
  { value: 'merged', label: STAFF_STATUS_LABELS.merged },
] as const;
