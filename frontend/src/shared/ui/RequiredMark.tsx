import type { JSX } from 'react';

/**
 * Red asterisk marking a mandatory form field. Decorative only — the input
 * itself carries aria-required so the accessible name (and label queries)
 * stay unchanged.
 */
export function RequiredMark(): JSX.Element {
  return (
    <span aria-hidden="true" className="text-red-600">
      {' '}
      *
    </span>
  );
}
