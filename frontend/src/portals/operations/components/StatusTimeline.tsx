import type { StatusHistoryEntry } from '../types';
import { statusLabel } from './statusMeta';

const STEPS = [
  'draft',
  'submitted',
  'ai_processing',
  'pending_moderator',
  'assigned',
  'accepted',
  'in_progress',
  'resolved',
  'closed',
];

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
  const currentIndex = STEPS.indexOf(current ?? 'draft');

  return (
    <div className="relative flex items-start justify-between gap-1">
      <div className="absolute left-0 right-0 top-4 h-0.5 bg-slate-200" />
      <div
        className="absolute left-0 top-4 h-0.5 bg-emerald-500 transition-all"
        style={{ width: `${(currentIndex / (STEPS.length - 1)) * 100}%` }}
      />
      {STEPS.map((code, index) => {
        const done = index < currentIndex;
        const active = code === current;
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
  );
}
