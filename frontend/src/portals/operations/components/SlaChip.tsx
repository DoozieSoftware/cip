import { Badge } from '../design';

/**
 * Compute the SLA chip label for a report.
 *
 * - No SLA configured (missing values) -> null (chip is hidden).
 * - 'resolved' / 'closed' -> the SLA is met.
 * - Otherwise compare `createdAt + slaMinutes` against `now` and report
 *   full hours left or overdue (rounded up, never below 1h).
 *
 * The last `now` argument exists so unit tests stay deterministic;
 * production callers use the default.
 */
export function computeSlaLabel(
  createdAt: string | null | undefined,
  slaMinutes: number | null | undefined,
  status: string | null | undefined,
  now: number = Date.now(),
): string | null {
  if (!createdAt || !slaMinutes || slaMinutes <= 0) return null;
  if (status === 'resolved' || status === 'closed') return 'SLA met';
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return null;
  const remaining = created + slaMinutes * 60_000 - now;
  const hours = Math.max(1, Math.ceil(Math.abs(remaining) / 3_600_000));
  return remaining >= 0 ? `SLA: ${hours}h left` : `SLA: overdue by ${hours}h`;
}

export function SlaChip({
  createdAt,
  slaMinutes,
  status,
}: {
  createdAt: string | null | undefined;
  slaMinutes: number | null | undefined;
  status: string | null | undefined;
}) {
  const label = computeSlaLabel(createdAt, slaMinutes, status);
  if (label === null) return null;
  const tone = label.startsWith('SLA: overdue') ? 'danger' : 'success';
  return <Badge tone={tone}>{label}</Badge>;
}
