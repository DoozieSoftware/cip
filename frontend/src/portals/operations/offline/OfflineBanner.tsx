import type { JSX } from 'react';
import { IconCloudOff, IconCloudUpload, IconAlertTriangle, IconRefresh } from '@tabler/icons-react';
import { useOpsQueue } from './useOpsQueue';

export function OfflineBanner(): JSX.Element | null {
  const { pending, dead, isOnline, drain } = useOpsQueue();
  const pendingCount = pending.length;
  const deadCount = dead.length;

  if (pendingCount === 0 && deadCount === 0 && isOnline) return null;

  return (
    <div className="space-y-2">
      {!isOnline ? (
        <div role="status" aria-label="Offline — collections will be queued" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <IconCloudOff className="h-4 w-4 shrink-0 text-amber-700" />
          <p className="text-xs font-medium text-amber-800">You are offline — new collections will be queued and uploaded when you are back online. Nothing is lost.</p>
        </div>
      ) : null}
      {pendingCount > 0 ? (
        <div role="status" aria-label={`${pendingCount} pending upload${pendingCount === 1 ? '' : 's'}`} className="flex items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <IconCloudUpload className="h-4 w-4 shrink-0 text-sky-700" />
            <p className="text-xs font-medium text-sky-800">{pendingCount} pending upload{pendingCount === 1 ? '' : 's'} — will retry automatically when online.</p>
          </div>
          <button type="button" onClick={() => void drain()} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-sky-300 bg-white px-3 text-xs font-medium text-sky-800">
            <IconRefresh className="h-3.5 w-3.5" /> Retry now
          </button>
        </div>
      ) : null}
      {deadCount > 0 ? (
        <div role="alert" aria-label={`${deadCount} failed upload${deadCount === 1 ? '' : 's'} need attention`} className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <IconAlertTriangle className="h-4 w-4 shrink-0 text-rose-700" />
            <p className="text-xs font-medium text-rose-800">{deadCount} upload{deadCount === 1 ? '' : 's'} failed — open Recovery to fix or retry.</p>
          </div>
          <a href="/operations/textile-collections/recovery" className="inline-flex min-h-8 items-center rounded-full border border-rose-300 bg-white px-3 text-xs font-medium text-rose-800">Open recovery</a>
        </div>
      ) : null}
    </div>
  );
}
