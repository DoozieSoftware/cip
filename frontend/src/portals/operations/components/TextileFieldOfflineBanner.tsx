import { useEffect, useState, type JSX } from 'react';
import { IconWifiOff, IconRefresh, IconAlertTriangle, IconTrash } from '@tabler/icons-react';
import { getQueue, type QueueItem } from '../../citizen/offline/queue';
import { readSession } from '../../../auth/storage';

export function TextileFieldOfflineBanner(): JSX.Element | null {
  const ownerId = readSession()?.user.id ?? null;
  const [pending, setPending] = useState<QueueItem[]>([]);
  const [dead, setDead] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);

  async function refresh(): Promise<void> {
    const q = getQueue(ownerId);
    const p = await q.pending();
    const d = await q.dead();
    setPending(p.filter((i) => i.kind === 'textile.field.outcome'));
    setDead(d.filter((i) => i.kind === 'textile.field.outcome'));
  }

  useEffect(() => {
    void refresh();
    const q = getQueue(ownerId);
    const off = q.subscribe(() => void refresh());
    const onOnline = () => void refresh();
    window.addEventListener('online', onOnline);
    const id = window.setInterval(() => void refresh(), 3000);
    return () => {
      off();
      window.removeEventListener('online', onOnline);
      window.clearInterval(id);
    };
  }, [ownerId]);

  if (pending.length === 0 && dead.length === 0) return null;

  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-amber-200 bg-amber-50 p-4"
      data-testid="field-offline-banner"
    >
      {pending.length > 0 ? (
        <div className="flex gap-3">
          <IconWifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-800">
              {pending.length} field collection{pending.length === 1 ? '' : 's'} pending upload
              {isOffline ? ' — offline' : ' — retrying automatically'}
            </p>
            <p className="mt-1 text-xs leading-5 text-amber-700">
              Proof photo, bags and weight are saved <span className="font-medium">for your account only</span> on this
              device. Retry is idempotent — one final outcome will be recorded. Not transferred to another staff member or
              device. Cleared after confirmed upload.
            </p>
            <ul className="mt-2 space-y-1 text-xs text-amber-700">
              {pending.slice(0, 4).map((item) => (
                <li key={item.id} className="truncate">
                  • {String((item.payload as { collectionId?: string })?.collectionId ?? item.id).slice(0, 12)}… —{' '}
                  {item.status} pending upload
                  {item.attempts ? ` · retry ${item.attempts}` : ''}
                </li>
              ))}
              {pending.length > 4 ? <li className="text-[11px]">+{pending.length - 4} more</li> : null}
            </ul>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await getQueue(ownerId).drain();
                  await refresh();
                } finally {
                  setBusy(false);
                }
              }}
              className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-amber-900 px-3.5 text-xs font-medium text-white disabled:opacity-50"
            >
              <IconRefresh className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
              {busy ? 'Retrying…' : 'Retry now'}
            </button>
          </div>
        </div>
      ) : null}

      {dead.length > 0 ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-white p-3">
          <p className="flex items-center gap-2 text-xs font-medium text-red-700">
            <IconAlertTriangle className="h-4 w-4" /> {dead.length} upload{dead.length === 1 ? '' : 's'} failed permanently
          </p>
          <p className="mt-1 text-xs leading-5 text-red-600">
            Retry is exhausted (corrupted file, expired session, or device mismatch). Proof remains on this device until you
            review. Authorised recovery: retry or discard. Session expiry or logout keeps data isolated per account — no
            cross-device sync.
          </p>
          <ul className="mt-2 space-y-2">
            {dead.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 rounded border border-black/10 bg-zinc-50 px-2 py-1.5 text-xs">
                <span className="truncate">{item.last_error ?? 'Upload failed'} — pending review</span>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={async () => {
                      await getQueue(ownerId).drain();
                      await refresh();
                    }}
                    className="rounded-full border border-black/15 bg-white px-2 py-1 text-[11px] font-medium"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await getQueue(ownerId).remove(item.id);
                      await refresh();
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-black/15 bg-white px-2 py-1 text-[11px] font-medium"
                    aria-label="Dismiss failed upload"
                  >
                    <IconTrash className="h-3 w-3" /> Dismiss
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
