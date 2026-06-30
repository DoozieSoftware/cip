import { type JSX } from 'react';
import { cx } from '../../moderator/design/cx';

/**
 * Citizen-side status badge for a report.
 *
 * Colours mirror the moderator/operations palette so the
 * citizen sees the same status the operator does.
 */
const STATUS_COLOR: Record<string, string> = {
  submitted: 'bg-slate-100 text-slate-800 border-slate-200',
  pending_moderator: 'bg-amber-100 text-amber-800 border-amber-200',
  pending_review: 'bg-amber-100 text-amber-800 border-amber-200',
  ai_processing: 'bg-sky-100 text-sky-800 border-sky-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  assigned: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  in_progress: 'bg-sky-100 text-sky-800 border-sky-200',
  resolved: 'bg-emerald-200 text-emerald-900 border-emerald-300',
  closed: 'bg-slate-200 text-slate-800 border-slate-300',
  rejected: 'bg-rose-100 text-rose-800 border-rose-200',
  merged: 'bg-violet-100 text-violet-800 border-violet-200',
  escalated: 'bg-orange-100 text-orange-800 border-orange-200',
  duplicate: 'bg-slate-200 text-slate-700 border-slate-300',
};

const STATUS_ICON: Record<string, string> = {
  submitted: '📨',
  pending_moderator: '⏳',
  pending_review: '⏳',
  ai_processing: '🤖',
  approved: '✅',
  assigned: '📌',
  in_progress: '🛠️',
  resolved: '🎉',
  closed: '🔒',
  rejected: '✗',
  merged: '🔗',
  escalated: '⚠️',
  duplicate: '👯',
};

export interface StatusBadgeProps {
  status: { code: string; name?: string };
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps): JSX.Element {
  const color = STATUS_COLOR[status.code] ?? 'bg-slate-100 text-slate-800 border-slate-200';
  const icon = STATUS_ICON[status.code] ?? '•';
  const label = status.name ?? status.code;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        color,
        className,
      )}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  );
}
