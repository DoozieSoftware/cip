import type { ReactNode } from 'react';
import { cx } from './cx';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'purple';

const TONE: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  purple: 'bg-violet-50 text-violet-700 ring-violet-200',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
