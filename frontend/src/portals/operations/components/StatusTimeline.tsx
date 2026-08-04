import { Badge } from '../design';
import type { StatusHistoryEntry } from '../types';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

/**
 * Human label for a status code, shared by the header Badge and the
 * timeline (mirrors the list page convention: underscore -> space).
 */
export function statusLabel(code: string | null | undefined): string {
  if (!code) return '—';
  return code.replace(/_/g, ' ');
}

/**
 * Badge tone per status code, matching the ReportListPage convention
 * (assigned/accepted/in_progress = info, resolved/verified = success,
 * closed = neutral, rejected/merged = warning, escalated = danger).
 */
export function statusTone(code: string | null | undefined): StatusTone {
  switch (code) {
    case 'assigned':
    case 'accepted':
    case 'in_progress':
      return 'info';
    case 'resolved':
    case 'verified':
      return 'success';
    case 'closed':
      return 'neutral';
    case 'rejected':
    case 'merged':
      return 'warning';
    case 'escalated':
      return 'danger';
    default:
      return 'neutral';
  }
}

/** Vertical lifecycle trail, oldest -> newest, as returned by the API. */
export function StatusTimeline({ entries }: { entries: StatusHistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">No status changes recorded yet.</p>;
  }
  return (
    <ol className="space-y-4 border-l border-slate-200 pl-5">
      {entries.map((entry, index) => (
        <li key={`${entry.to_code ?? 'unknown'}-${entry.created_at ?? index}`} className="relative">
          <span
            aria-hidden
            className="absolute -left-[26px] top-1.5 h-2 w-2 rounded-full bg-slate-300"
          />
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-800">
            <Badge tone={statusTone(entry.from_code)}>{statusLabel(entry.from_code)}</Badge>
            <span aria-hidden className="text-slate-400">
              →
            </span>
            <Badge tone={statusTone(entry.to_code)}>{statusLabel(entry.to_code)}</Badge>
          </p>
          {entry.reason && <p className="mt-1 text-sm text-slate-600">{entry.reason}</p>}
          {entry.created_at && (
            <p className="mt-0.5 text-xs text-slate-500">
              {new Date(entry.created_at).toLocaleString()}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
