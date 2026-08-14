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

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

  return (
    <div className="space-y-2">
      {offPath && current !== null && (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            statusTone(current) === 'danger'
              ? 'bg-rose-50 text-rose-700'
              : statusTone(current) === 'warning'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-sky-50 text-sky-700'
          }`}
        >
          {statusLabel(current)}
        </span>
      )}
      <div className="relative flex items-start justify-between gap-2">
        <div className="absolute left-0 right-0 top-4 h-0.5 bg-slate-200" />
        <div
          className="absolute left-0 top-4 h-0.5 bg-emerald-500 transition-all"
          style={{ width: `${(currentIndex / (STEPS.length - 1)) * 100}%` }}
        />
        {STEPS.map((code, index) => {
          const done = index < currentIndex;
          const active = !offPath && code === current;
          const entry = entries.find((e) => e.to_code === code);
          return (
            <div key={code} className="relative z-10 flex flex-1 flex-col items-center min-w-0">
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
              <span
                className={
                  'mt-1.5 w-full truncate text-center text-[11px] leading-tight ' +
                  (active
                    ? 'font-medium text-blue-700 '
                    : done
                      ? 'text-slate-700 '
                      : 'text-slate-400 ')
                }
                title={statusLabel(code)}
              >
                {statusLabel(code)}
              </span>
              {entry?.created_at && (
                <span className="mt-0.5 truncate text-[10px] tabular-nums text-slate-500">
                  {formatTimestamp(entry.created_at)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
