export interface SlaInfo {
  deadline: Date;
  overdue: boolean;
  remainingMs: number;
}

export interface SlaDisplay {
  label: string;
  tone: 'success' | 'danger' | 'neutral';
}

export function slaInfo(
  createdAt: string | null | undefined,
  slaMinutes: number | null | undefined,
): SlaInfo | null {
  if (slaMinutes == null || createdAt == null) return null;
  const start = new Date(createdAt).getTime();
  if (Number.isNaN(start)) return null;
  const deadline = new Date(start + slaMinutes * 60_000);
  const remainingMs = deadline.getTime() - Date.now();
  return { deadline, overdue: remainingMs < 0, remainingMs };
}

/**
 * Humanized duration for SLA chips/badges.
 * Use full words because these labels are read by field staff, not only
 * scanned as compact dashboard metrics.
 */
export function humanizeSlaDuration(ms: number): string {
  const abs = Math.abs(ms);
  const hours = Math.ceil(abs / 3_600_000);
  if (hours < 1) return 'less than 1 hour';
  if (hours < 48) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const days = Math.ceil(hours / 24);
  if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'}`;
  const weeks = Math.ceil(days / 7);
  return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
}

/**
 * Compute the SLA chip label for a report, humanized for readability:
 *   "Due in 2 hours" / "Due in 3 days" / "Overdue by 3 weeks" / "SLA met".
 *
 * The `now` argument exists so unit tests stay deterministic;
 * production callers use the default.
 */
export function computeSlaLabel(
  createdAt: string | null | undefined,
  slaMinutes: number | null | undefined,
  status: string | null | undefined,
  now: number = Date.now(),
): string | null {
  const display = formatSla(createdAt, slaMinutes, status, now);
  return display?.label ?? null;
}

export function formatSla(
  createdAt: string | null | undefined,
  slaMinutes: number | null | undefined,
  status: string | null | undefined,
  now: number = Date.now(),
): SlaDisplay | null {
  if (!createdAt || !slaMinutes || slaMinutes <= 0) return null;
  if (status === 'resolved' || status === 'verified' || status === 'closed') {
    return { label: 'SLA met', tone: 'success' };
  }
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return null;
  const remaining = created + slaMinutes * 60_000 - now;
  if (remaining >= 0) {
    return { label: `Due in ${humanizeSlaDuration(remaining)}`, tone: 'success' };
  }
  return { label: `Overdue by ${humanizeSlaDuration(remaining)}`, tone: 'danger' };
}
