export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

/**
 * Human label for a status code, shared by the list, detail header, and timeline.
 * Title-cased for a product-grade look (e.g. "In Progress", "Pending Moderator").
 */
export function statusLabel(code: string | null | undefined): string {
  if (!code) return '—';
  return code
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAi\b/g, 'AI');
}

/** Keep status tone mapping in one place so all operations screens agree. */
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
