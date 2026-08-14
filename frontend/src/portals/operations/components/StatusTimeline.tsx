import { StepTimeline, type StepTimelineStep } from '../../../shared/components/StepTimeline';
import type { StatusHistoryEntry } from '../types';
import { statusLabel, statusTone } from './statusMeta';

// The happy path per the actual workflow_transitions graph — in_progress
// resolves straight to resolved_pending_verification (a plain "resolved"
// status is never assigned to a real report) which then either verifies
// or closes directly. rejected / merged / escalated / reopened branch off
// this path entirely and are handled separately below, not force-fit into
// a linear step index.
const STEPS = [
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

const OFF_PATH_CODES = new Set(['rejected', 'merged', 'escalated', 'reopened']);

export function StatusTimeline({ entries }: { entries: StatusHistoryEntry[] }) {
  const current = entries.length > 0 ? entries[entries.length - 1]?.to_code : null;
  const offPath = current !== null && OFF_PATH_CODES.has(current);

  // For an off-path status (e.g. escalated), fall back to the most recent
  // on-path status reached so progress-so-far still renders instead of
  // collapsing to index -1 (which produced a negative-width bar and left
  // every step showing as untouched, even for a fully resolved report).
  const referenceCode = offPath
    ? [...entries].reverse().find((e) => e.to_code !== null && STEPS.includes(e.to_code))?.to_code
    : current;
  const currentIndex = STEPS.indexOf(referenceCode ?? 'draft');

  const steps: StepTimelineStep[] = STEPS.map((code) => ({
    code,
    label: statusLabel(code),
    at: entries.find((e) => e.to_code === code)?.created_at ?? null,
  }));

  const offPathBadge =
    offPath && current !== null
      ? {
          label: statusLabel(current),
          tone:
            statusTone(current) === 'danger'
              ? ('danger' as const)
              : statusTone(current) === 'warning'
                ? ('warning' as const)
                : ('info' as const),
        }
      : null;

  return (
    <StepTimeline
      steps={steps}
      currentIndex={currentIndex}
      activeIndex={offPath ? null : currentIndex}
      offPathBadge={offPathBadge}
    />
  );
}
