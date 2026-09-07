import { type JSX } from 'react';
import { citizenReportStatusLabel } from '../../../shared/statusDisplay';
import { cx } from '../../../shared/ui/cx';

/**
 * Citizen-side status badge for a report.
 *
 * Colours mirror the moderator/operations palette so the
 * citizen sees the same status the operator does.
 */
const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-[var(--color-surface-alt)] text-[var(--color-ink-soft)] border-[var(--color-border)]',
  submitted:
    'bg-[var(--color-surface-alt)] text-[var(--color-ink-soft)] border-[var(--color-border)]',
  pending_moderator:
    'bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning-muted)]',
  pending_review:
    'bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning-muted)]',
  ai_processing:
    'bg-[var(--color-info)]/10 text-[var(--color-info)] border-[var(--color-info-muted)]',
  approved:
    'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success-muted)]',
  assigned:
    'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success-muted)]',
  accepted:
    'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success-muted)]',
  in_progress:
    'bg-[var(--color-info)]/10 text-[var(--color-info)] border-[var(--color-info-muted)]',
  reopened: 'bg-[var(--color-info)]/10 text-[var(--color-info)] border-[var(--color-info-muted)]',
  resolved:
    'bg-[var(--color-success)]/15 text-[var(--color-success)] border-[var(--color-success-muted)]',
  resolved_pending_verification:
    'bg-[var(--color-success)]/15 text-[var(--color-success)] border-[var(--color-success-muted)]',
  verified:
    'bg-[var(--color-surface-alt)] text-[var(--color-ink-soft)] border-[var(--color-border)]',
  closed: 'bg-[var(--color-surface-alt)] text-[var(--color-ink-soft)] border-[var(--color-border)]',
  rejected:
    'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger-muted)]',
  merged: 'bg-[var(--color-surface-alt)] text-[var(--color-ink-soft)] border-[var(--color-border)]',
  escalated:
    'bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning-muted)]',
  duplicate:
    'bg-[var(--color-surface-alt)] text-[var(--color-ink-soft)] border-[var(--color-border)]',
};

const STATUS_DOT: Record<string, string> = {
  draft: 'bg-[var(--color-text-tertiary)]',
  submitted: 'bg-[var(--color-text-tertiary)]',
  pending_moderator: 'bg-[var(--color-warning)]',
  pending_review: 'bg-[var(--color-warning)]',
  ai_processing: 'bg-[var(--color-info)]',
  approved: 'bg-[var(--color-success)]',
  assigned: 'bg-[var(--color-success)]',
  accepted: 'bg-[var(--color-success)]',
  in_progress: 'bg-[var(--color-info)]',
  reopened: 'bg-[var(--color-info)]',
  resolved: 'bg-[var(--color-success)]',
  resolved_pending_verification: 'bg-[var(--color-success)]',
  verified: 'bg-[var(--color-text-tertiary)]',
  closed: 'bg-[var(--color-text-tertiary)]',
  rejected: 'bg-[var(--color-danger)]',
  merged: 'bg-[var(--color-ink-soft)]',
  escalated: 'bg-[var(--color-warning)]',
  duplicate: 'bg-[var(--color-text-tertiary)]',
};

export interface StatusBadgeProps {
  status: { code: string; name?: string };
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps): JSX.Element {
  const color =
    STATUS_COLOR[status.code] ??
    'bg-[var(--color-surface-alt)] text-[var(--color-ink-soft)] border-[var(--color-border)]';
  const dot = STATUS_DOT[status.code] ?? 'bg-[var(--color-text-tertiary)]';
  const label = citizenReportStatusLabel(status.code);
  return (
    <span
      className={cx(
        'inline-flex max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold leading-tight',
        color,
        className,
      )}
    >
      <span aria-hidden className={cx('h-1.5 w-1.5 rounded-full', dot)} />
      {label}
    </span>
  );
}
