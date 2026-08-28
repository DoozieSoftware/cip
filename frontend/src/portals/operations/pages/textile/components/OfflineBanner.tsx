import type { JSX } from 'react';
import { IconCloudOff, IconCloudUpload, IconAlertTriangle, IconRefresh } from '@tabler/icons-react';
import type { OfflineQueuedCollection } from '../../../api/offlineQueue';

export function OfflineBanner({
  isOnline,
  pendingCount,
  failedCount,
  items,
  onRetryAll,
  onRetryOne,
  onClearCompleted,
  onRemove,
  isRetrying,
}: {
  isOnline: boolean;
  pendingCount: number;
  failedCount: number;
  items: OfflineQueuedCollection[];
  onRetryAll: () => void;
  onRetryOne: (key: string) => void;
  onClearCompleted: () => void;
  onRemove: (key: string) => void;
  isRetrying: boolean;
}): JSX.Element | null {
  const hasAny = items.length > 0;
  if (!hasAny && isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-xl border px-4 py-3 text-sm ${!isOnline ? 'border-amber-300 bg-amber-50' : failedCount > 0 ? 'border-rose-300 bg-rose-50' : pendingCount > 0 ? 'border-indigo-200 bg-indigo-50' : 'border-black/10 bg-white'}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        {!isOnline ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-amber-800">
            <IconCloudOff className="h-4 w-4" /> Offline — collections will be queued
          </span>
        ) : pendingCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-indigo-700">
            <IconCloudUpload className="h-4 w-4" /> {pendingCount} pending upload{pendingCount === 1 ? '' : 's'}
          </span>
        ) : failedCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-rose-700">
            <IconAlertTriangle className="h-4 w-4" /> {failedCount} failed upload{failedCount === 1 ? '' : 's'} — needs recovery
          </span>
        ) : (
          <span className="text-[var(--color-text-secondary)]">All uploads synced</span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {pendingCount > 0 || failedCount > 0 ? (
            <button
              type="button"
              onClick={onRetryAll}
              disabled={isRetrying || !isOnline}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-3.5 text-xs font-medium text-white disabled:opacity-40"
            >
              <IconRefresh className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying…' : 'Retry all'}
            </button>
          ) : null}
          {items.some((i) => i.status === 'completed') ? (
            <button
              type="button"
              onClick={onClearCompleted}
              className="min-h-9 rounded-full border border-black/15 bg-white px-3.5 text-xs"
            >
              Clear completed
            </button>
          ) : null}
        </div>
      </div>

      {items.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.idempotencyKey}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs"
            >
              <span className="font-mono">{item.collectionReference}</span>
              <span>{item.bags} bags · {item.weight} kg</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${item.status === 'pending' ? 'bg-amber-100 text-amber-800' : item.status === 'uploading' ? 'bg-indigo-100 text-indigo-700' : item.status === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}
              >
                {item.status === 'pending' ? 'Pending upload' : item.status === 'uploading' ? 'Uploading…' : item.status === 'failed' ? 'Failed' : 'Completed'}
              </span>
              {item.lastError ? <span className="text-rose-600">{item.lastError}</span> : null}
              <span className="text-[var(--color-text-tertiary)]">
                {new Date(item.createdAt).toLocaleString()} · attempt {item.attempts}
              </span>
              <div className="ml-auto flex gap-1.5">
                {item.status === 'failed' || item.status === 'pending' ? (
                  <button
                    type="button"
                    onClick={() => onRetryOne(item.idempotencyKey)}
                    disabled={!isOnline || isRetrying}
                    className="rounded-full border border-black/15 px-2.5 py-1 text-[11px] disabled:opacity-40"
                  >
                    Retry
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onRemove(item.idempotencyKey)}
                  className="rounded-full border border-black/15 px-2.5 py-1 text-[11px]"
                  aria-label={`Remove queued item ${item.collectionReference}`}
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!isOnline ? (
        <p className="mt-2 text-xs text-amber-700">
          Proof photos are stored locally and tied to your session. They will retry when connectivity returns and clear after confirmed upload. Logging out clears pending uploads on this device; a device change keeps them on the original device.
        </p>
      ) : null}
      {failedCount > 0 ? (
        <p className="mt-2 text-xs text-rose-700">
          Failed uploads are not discarded — resolve them here or in the recovery view. Corrupted or expired-session uploads require re-capture or re-login.
        </p>
      ) : null}
    </div>
  );
}
