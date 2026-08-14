import { reportStatusTone, staffReportStatusLabel } from './statusDisplay';
import type { StepTimelineStep, StepTimelineTone } from './components/StepTimeline';

/**
 * Full workflow happy path, shared by every staff-facing report-detail
 * page (moderator, operations) — per the actual workflow_transitions
 * graph, in_progress resolves straight to resolved_pending_verification
 * (a plain "resolved" status is never assigned to a real report), which
 * then either verifies or closes directly.
 */
export const STAFF_WORKFLOW_STEPS = [
  'draft',
  'submitted',
  'ai_processing',
  'pending_moderator',
  'assigned',
  'accepted',
  'in_progress',
  'resolved_pending_verification',
  'verified',
  'closed',
];

/** Branches off the happy path — never force-fit into a linear step index. */
export const OFF_PATH_STATUS_CODES = new Set(['rejected', 'merged', 'escalated', 'reopened']);

interface MinimalStatusEntry {
  to_code: string | null;
  created_at?: string | null;
}

export interface StaffTimeline {
  steps: StepTimelineStep[];
  currentIndex: number;
  activeIndex: number | null;
  offPathBadge: { label: string; tone: StepTimelineTone } | null;
}

function toStepTone(tone: ReturnType<typeof reportStatusTone>): StepTimelineTone {
  return tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : 'info';
}

/**
 * Turn a report's raw status_history into the shape <StepTimeline>
 * needs, for any staff-facing portal on the same workflow. Off-path
 * statuses (rejected/merged/escalated/reopened) fall back to the most
 * recent on-path status reached, so progress-so-far still renders
 * instead of collapsing to a negative-width bar with every step
 * showing as untouched.
 */
export function buildStaffTimeline(entries: MinimalStatusEntry[]): StaffTimeline {
  const current = entries.length > 0 ? (entries[entries.length - 1]?.to_code ?? null) : null;
  const offPath = current !== null && OFF_PATH_STATUS_CODES.has(current);

  const referenceCode = offPath
    ? [...entries].reverse().find((e) => e.to_code !== null && STAFF_WORKFLOW_STEPS.includes(e.to_code))
        ?.to_code
    : current;
  const currentIndex = STAFF_WORKFLOW_STEPS.indexOf(referenceCode ?? 'draft');

  const steps: StepTimelineStep[] = STAFF_WORKFLOW_STEPS.map((code) => ({
    code,
    label: staffReportStatusLabel(code),
    at: entries.find((e) => e.to_code === code)?.created_at ?? null,
  }));

  const offPathBadge =
    offPath && current !== null
      ? { label: staffReportStatusLabel(current), tone: toStepTone(reportStatusTone(current)) }
      : null;

  return {
    steps,
    currentIndex,
    activeIndex: offPath ? null : currentIndex,
    offPathBadge,
  };
}
