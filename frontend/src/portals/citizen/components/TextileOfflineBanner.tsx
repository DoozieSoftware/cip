import { useEffect, useState, type JSX } from 'react';
import { IconWifiOff, IconRefresh, IconTrash, IconAlertTriangle } from '@tabler/icons-react';
import { getQueue, type QueueItem } from '../offline/queue';
import { readSession } from '../../../auth/storage';

type TextileQueueItem = QueueItem<{
  title?: string;
  collectionId?: string;
  outcome?: string;
}>;

function formatKind(kind: string): string {
  if (kind === 'textile.request.create') return 'Collection request';
  if (kind === 'textile.request.photo') return 'Collection photo';
  if (kind === 'textile.field.outcome') return 'Field collection';
  return kind;
}

export function TextileOfflineBanner(): JSX.Element | null {
  const ownerId = readSession()?.user.id ?? null;
  const [pending, setPending] = useState<TextileQueueItem[]>([]);
  const [dead, setDead] = useState<TextileQueueItem[]>([]);
  const [retryBusy, setRetryBusy] = useState(false);

  async function refresh(): Promise<void> {
    const q = getQueue(ownerId);
    const p = (await q.pending()) as TextileQueueItem[];
    const d = (await q.dead()) as TextileQueueItem[];
    setPending(p.filter((i) => i.kind.startsWith('textile.')));
    setDead(d.filter((i) => i.kind.startsWith('textile.')));
  }

  useEffect(() => {
    void refresh();
    const q = getQueue(ownerId);
    const off = q.subscribe(() => void refresh());
    window.addEventListener('online', refresh);
    const t = window.setInterval(() => void refresh(), 2500);
    return () => {
      off();
      window.removeEventListener('online', refresh);
      window.clearInterval(t);
    };
  }, [ownerId]);

  if (pending.length === 0 && dead.length === 0) return null;

  async function handleRetry(): Promise<void> {
    setRetryBusy(true);
    try {
      await getQueue(ownerId).drain();
      await refresh();
    } finally {
      setRetryBusy(false);
    }
  }

  async function handleClearDead(id: string): Promise<void> {
    await getQueue(ownerId).remove(id);
    await refresh();
  }

  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"
      data-testid="textile-offline-banner"
    >
      {pending.length > 0 ? (
        <div className="flex items-start gap-3">
          <IconWifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-amber-800">
              {pending.length} textile {pending.length === 1 ? 'item' : 'items'} pending upload
              {isOffline ? ' — offline' : ' — will retry shortly'}
            </p>
            <p className="mt-1 text-xs leading-5 text-amber-700">
              Proof photo, quantities and outcome are saved on this device for{' '}
              <span className="font-medium">your account only</span> and will upload automatically
              when you are back online. No proof is silently discarded. Retry is idempotent — one
              final outcome will be recorded.
            </p>
            <ul className="mt-2 space-y-1 text-xs text-amber-700">
              {pending.slice(0, 3).map((item) => (
                <li key={item.id} className="truncate">
                  • {formatKind(item.kind)} — {item.status} {item.attempts > 0 ? `(retry ${item.attempts})` : ''} · pending upload
                </li>
              ))}
              {pending.length > 3 ? <li className="text-[11px]">+{pending.length - 3} more</li> : null}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleRetry()}
                disabled={retryBusy}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-amber-900 px-3.5 text-xs font-medium text-white disabled:opacity-50"
              >
                <IconRefresh className={`h-3.5 w-3.5 ${retryBusy ? 'animate-spin' : ''}`} />
                {retryBusy ? 'Retrying…' : 'Retry now'}
              </button>
              <span className="text-[11px] leading-5 text-amber-700">
                Cleared after confirmed upload. Logout or session expiry keeps data safe — it never
                syncs to another account or device.
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {dead.length > 0 ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-white p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-red-700">
            <IconAlertTriangle className="h-4 w-4" /> {dead.length} upload{dead.length === 1 ? '' : 's'} failed permanently — needs your review
          </div>
          <p className="mt-1 text-xs leading-5 text-red-600">
            These were not delivered after multiple retries (corrupt file, changed device, or expired
            session). Open the recovery view to retry or discard. Proof is still on this device until
            you clear it.
          </p>
          <ul className="mt-2 space-y-2">
            {dead.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 rounded border border-black/10 bg-zinc-50 px-2 py-1.5 text-xs">
                <span className="truncate">
                  {formatKind(item.kind)} · {item.last_error ?? 'Upload failed'}
                </span>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => void handleRetry()}
                    className="rounded-full bg-white px-2 py-1 text-[11px] font-medium border border-black/15"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleClearDead(item.id)}
                    className="rounded-full bg-white px-2 py-1 text-[11px] font-medium border border-black/15 inline-flex items-center gap-1"
                    aria-label="Discard failed upload"
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
