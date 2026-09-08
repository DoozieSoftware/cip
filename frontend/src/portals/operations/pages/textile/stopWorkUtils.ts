import { ApiError } from '../../../../shared/api/errors';

/* Button system — 44px targets, 8pt grid, one solid primary per stop.
 * Call/Navigate are outline with colored intent on hover; Mark missed is
 * destructive outline. All share h-11, rounded-lg, 14px — no color soup. */
export const STOP_BTN = {
  primary:
    'inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-ink)] px-5 text-[14px] font-semibold tracking-tight text-white shadow-sm transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-2 disabled:opacity-40',
  call: 'inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-4 text-[14px] font-medium text-[var(--color-ink)] shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-[var(--color-success)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-success)] focus-visible:ring-offset-1 disabled:opacity-40',
  navigate:
    'inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-4 text-[14px] font-medium text-[var(--color-ink)] shadow-sm transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 disabled:opacity-40',
  danger:
    'inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-4 text-[14px] font-medium text-[var(--color-danger)] shadow-sm transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] focus-visible:ring-offset-1 disabled:opacity-40',
};

export function telHref(phone: string): string {
  return `tel:${phone.replace(/\s/g, '')}`;
}

export function mapsHref(address: string): string {
  const q = encodeURIComponent(address);
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  return isIOS ? `maps://?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID();
  return `collect-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isOfflineError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed')
  )
    return true;
  const anyErr = err as { status?: number; code?: string };
  if (anyErr?.status === 0 || anyErr?.code === 'OFFLINE') return true;
  if (anyErr?.status !== undefined && anyErr.status >= 400) return false;
  return !(err instanceof ApiError);
}

export function isNetworkFailure(err: unknown): boolean {
  return !(err instanceof ApiError);
}

export function formatTripDate(raw: string): string {
  if (!raw) return '';
  // Expect YYYY-MM-DD
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!Number.isNaN(d.getTime()))
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  try {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime()))
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    // ignore parse error, fall through
  }
  return raw;
}

export function stopPageHref(batchId: string, stopId: string): string {
  return `/operations/textile-collections/dispatch/${batchId}/stops/${stopId}`;
}
