/**
 * Horizontal step tracker shared by the citizen, moderator, and
 * operations report-detail pages, so a report's progress reads the
 * same way regardless of which portal is looking at it.
 *
 * This component is purely presentational: it draws `steps` in order,
 * marks everything before `currentIndex` as done, and highlights
 * `activeIndex` (pass `null` when the report is off the happy path —
 * e.g. rejected/merged/escalated — so no step is falsely marked
 * current; pair that with `offPathBadge` to say what actually
 * happened). Each portal is responsible for turning its own status
 * history into this shape, since "what counts as a step" differs by
 * audience (citizens see collapsed plain-language stages; staff see
 * operational checkpoints with the same single Completed stage).
 */

export interface StepTimelineStep {
  code: string;
  label: string;
  at?: string | null;
}

export type StepTimelineTone = 'danger' | 'warning' | 'info';

const BADGE_TONE_CLASSES: Record<StepTimelineTone, string> = {
  danger: 'bg-rose-50 text-rose-700',
  warning: 'bg-amber-50 text-amber-700',
  info: 'bg-sky-50 text-sky-700',
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function StepTimeline({
  steps,
  currentIndex,
  activeIndex,
  offPathBadge,
}: {
  steps: StepTimelineStep[];
  /** Steps before this index render as done (checkmark, filled line). */
  currentIndex: number;
  /** Index of the step to highlight as "current"; null if off-path. */
  activeIndex: number | null;
  offPathBadge?: { label: string; tone: StepTimelineTone } | null;
}) {
  const progressPct = steps.length > 1 ? (currentIndex / (steps.length - 1)) * 100 : 0;

  return (
    <div className="space-y-2">
      {offPathBadge && (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${BADGE_TONE_CLASSES[offPathBadge.tone]}`}
        >
          {offPathBadge.label}
        </span>
      )}
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-2">
        {/* Vertical connector line (mobile): runs down the dot centre-line. */}
        <div
          className="absolute bottom-4 left-[15px] top-4 w-0.5 bg-slate-200 lg:hidden"
          aria-hidden="true"
        />
        {/* Horizontal progress line (sm+). */}
        <div
          className="absolute left-4 right-4 top-4 hidden h-0.5 bg-slate-200 lg:block"
          aria-hidden="true"
        />
        <div
          className="absolute left-4 top-4 hidden h-0.5 bg-emerald-500 transition-all lg:block"
          aria-hidden="true"
          style={{
            width: `calc(${progressPct}% - ${progressPct > 0 ? (progressPct * 32) / 100 : 0}px)`,
          }}
        />
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const active = index === activeIndex;
          return (
            <div
              key={step.code}
              className="relative z-10 flex min-w-0 flex-1 items-start gap-3 lg:flex-col lg:items-center lg:gap-0"
            >
              <span
                className={
                  'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ' +
                  (active
                    ? 'bg-blue-600 text-white ring-4 ring-blue-200 '
                    : done
                      ? 'bg-emerald-500 text-white '
                      : 'bg-slate-200 text-slate-400 ')
                }
              >
                {active && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-blue-400 opacity-60" />
                )}
                <span className="relative">{done ? '✓' : index + 1}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col lg:w-full lg:items-center">
                <span
                  className={
                    'text-[11px] leading-snug text-left lg:mt-1.5 lg:w-full lg:max-w-[8rem] lg:whitespace-normal lg:break-words lg:text-center [overflow-wrap:anywhere] ' +
                    (active
                      ? 'font-medium text-blue-700 '
                      : done
                        ? 'text-slate-700 '
                        : 'text-slate-400 ')
                  }
                >
                  {step.label}
                </span>
                {step.at && (
                  <span className="mt-0.5 text-left text-[10px] leading-snug tabular-nums text-slate-500 lg:w-full lg:max-w-[8rem] lg:whitespace-normal lg:break-words lg:text-center [overflow-wrap:anywhere]">
                    {formatTimestamp(step.at)}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
