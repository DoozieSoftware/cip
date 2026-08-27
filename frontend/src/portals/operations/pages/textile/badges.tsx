import type { JSX } from 'react';
import { cx } from '../../../../shared/ui';
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_STYLES } from './shared';

export function MethodBadge({ method }: { method: string }): JSX.Element {
  const label = method === 'dropoff' ? 'Drop-off' : method === 'premises' ? 'Pickup' : method;
  const style = method === 'dropoff' ? 'bg-sky-50 text-sky-800' : 'bg-violet-50 text-violet-800';
  return <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-medium', style)}>{label}</span>;
}
export function CategoryBadge({ category }: { category: string }): JSX.Element | null {
  const label = CATEGORY_LABELS[category];
  if (!label) return null;
  return <span className="font-mono text-[9px] uppercase tracking-[0.1em] rounded px-1.5 py-0.5 bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]">{label}</span>;
}
export function StatusBadge({ status }: { status: string }): JSX.Element {
  return <span className={cx('rounded-full px-2.5 py-1 text-[11px] font-medium', STATUS_STYLES[status] ?? 'bg-neutral-100')}>{STATUS_LABELS[status] ?? status}</span>;
}
export function VarianceBadge({ actual, estimated }: { actual: number | null; estimated: number | null }): JSX.Element | null {
  if (actual === null || estimated === null || estimated === 0) return null;
  const pct = ((actual - estimated) / estimated) * 100;
  const abs = Math.abs(pct);
  let cls = 'bg-emerald-50 text-emerald-700';
  if (abs >= 50 || pct < 0) cls = 'bg-rose-50 text-rose-700';
  else if (abs >= 25) cls = 'bg-amber-50 text-amber-800';
  return <span className={cx('rounded-full px-2 py-0.5 text-[10px] font-medium', cls)}>{pct > 0 ? '+' : ''}{pct.toFixed(0)}%</span>;
}
