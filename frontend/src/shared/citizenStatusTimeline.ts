import { citizenReportStatusLabel } from './statusDisplay';
import type { StepTimelineStep, StepTimelineTone } from './components/StepTimeline';

/**
 * The citizen-facing journey, per docs/mom-product-decisions.md §2.
 *
 * Citizens see five plain-language stages rather than the ten internal
 * workflow statuses: several codes collapse into one stage (submitted /
 * ai_processing / pending_moderator are all just "Received"), because a
 * citizen has no use for the distinction between "an AI is checking it"
 * and "a moderator is checking it" — both mean "we have it, nobody has
 * been dispatched yet".
 */
const CITIZEN_STAGES: Array<{ code: string; statuses: string[] }> = [
  { code: 'received', statuses: ['submitted', 'ai_processing', 'pending_moderator'] },
  { code: 'assigned', statuses: ['assigned', 'accepted'] },
  { code: 'in_progress', statuses: ['in_progress', 'reopened', 'escalated'] },
  { code: 'resolved', statuses: ['resolved', 'resolved_pending_verification'] },
  { code: 'completed', statuses: ['verified', 'closed'] },
];

/** Ends the journey early — shown as a badge, not as a stage. */
const CITIZEN_OFF_PATH: Record<string, StepTimelineTone> = {
  rejected: 'danger',
  merged: 'info',
};

interface MinimalStatusEntry {
  to_code?: string | null;
  created_at?: string | null;
  at?: string | null;
}

export interface CitizenTimeline {
  steps: StepTimelineStep[];
  currentIndex: number;
  activeIndex: number | null;
  offPathBadge: { label: string; tone: StepTimelineTone } | null;
}

function stageIndexFor(statusCode: string | null | undefined): number {
  if (!statusCode) return -1;

  return CITIZEN_STAGES.findIndex((stage) => stage.statuses.includes(statusCode));
}

/**
 * Build the citizen step tracker from a report's status history.
 *
 * `currentStatusCode` is passed separately because the citizen timeline
 * endpoint and the report detail payload can disagree briefly while a
 * background job is mid-transition; the report's own status is the
 * authoritative "where is it now".
 */
export function buildCitizenTimeline(
  entries: MinimalStatusEntry[],
  currentStatusCode: string | null | undefined,
): CitizenTimeline {
  // First time each stage was entered — a report that bounces back
  // (resolved -> reopened) should keep the original timestamp for the
  // earlier stage rather than showing the most recent visit.
  const stageTimestamps = new Map<number, string>();

  for (const entry of entries) {
    const index = stageIndexFor(entry.to_code);
    if (index === -1) continue;
    const at = entry.created_at ?? entry.at ?? null;
    if (at !== null && !stageTimestamps.has(index)) {
      stageTimestamps.set(index, at);
    }
  }

  const steps: StepTimelineStep[] = CITIZEN_STAGES.map((stage, index) => ({
    code: stage.code,
    label: citizenReportStatusLabel(stage.statuses[0]),
    at: stageTimestamps.get(index) ?? null,
  }));

  const offPathTone = currentStatusCode ? CITIZEN_OFF_PATH[currentStatusCode] : undefined;

  if (offPathTone) {
    // Keep whatever progress was made before the report left the path.
    const reached = [...stageTimestamps.keys()];
    const lastReached = reached.length > 0 ? Math.max(...reached) : 0;

    return {
      steps,
      currentIndex: lastReached,
      activeIndex: null,
      offPathBadge: {
        label: citizenReportStatusLabel(currentStatusCode),
        tone: offPathTone,
      },
    };
  }

  const currentIndex = Math.max(0, stageIndexFor(currentStatusCode));

  return { steps, currentIndex, activeIndex: currentIndex, offPathBadge: null };
}
