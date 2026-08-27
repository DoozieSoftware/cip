import type { JSX } from 'react';

export interface Step {
  key: string;
  label: string;
}
export function CollectionProgress({
  steps,
  currentIndex,
  tone = 'ok',
}: {
  steps: Step[];
  currentIndex: number;
  tone?: 'ok' | 'warn' | 'bad';
}): JSX.Element {
  const color =
    tone === 'bad' ? 'bg-red-600' : tone === 'warn' ? 'bg-amber-500' : 'bg-[var(--color-ink)]';
  const bg = 'bg-[var(--color-border-strong,#c8c6bf)]';
  return (
    <ol
      aria-label="Collection progress"
      className="mt-5 grid gap-1"
      style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}
    >
      {steps.map((s, i) => (
        <li
          key={s.key}
          aria-current={i === currentIndex ? 'step' : undefined}
          className="space-y-1"
        >
          <span
            className={`block h-1.5 rounded-full ${i <= currentIndex ? color : bg}`}
            aria-hidden="true"
          />
          <span className="sr-only">
            {s.label}
            {i === currentIndex ? ' (current step)' : ''}
          </span>
        </li>
      ))}
    </ol>
  );
}
