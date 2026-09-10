import type { JSX } from 'react';
import { cx } from '../../../../shared/ui';

// Single source of truth for shared badges lives in shared.tsx; re-export here
// so pages can import from either `shared` or `badges` without duplicating styles.
export { CategoryBadge, MethodBadge, StatusBadge, VarianceBadge } from './shared';
export { CATEGORY_LABELS, STATUS_LABELS, STATUS_STYLES } from './shared';

export function TripProgressBadge({ done, total }: { done: number; total: number }): JSX.Element {
  const pct = total > 0 ? done / total : 0;
  let cls = 'bg-indigo-50 text-indigo-700';
  if (pct === 1) cls = 'bg-emerald-50 text-emerald-700';
  else if (pct > 0) cls = 'bg-amber-50 text-amber-800';
  return (
    <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-medium', cls)}>
      {done}/{total} pickup{total === 1 ? '' : 's'}
    </span>
  );
}
export function TripStatusBadge({ status }: { status: string }): JSX.Element {
  const map: Record<string, string> = {
    planned: 'bg-indigo-50 text-indigo-700',
    in_progress: 'bg-amber-50 text-amber-800',
    completed: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <span
      className={cx(
        'rounded-full px-2 py-0.5 text-[11px] font-medium',
        map[status] ?? 'bg-neutral-100 text-neutral-700',
      )}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
