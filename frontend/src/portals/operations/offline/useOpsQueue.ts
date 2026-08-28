import { useEffect, useState, useCallback } from 'react';
import { getOpsQueue, type OpsQueueItem } from './queue';
import { useAuth } from '../../../auth/AuthContext';
import { registerTextileOfflineRetry } from './textileOfflineQueue';

export function useOpsQueue() {
  const { user } = useAuth();
  const ownerId = user?.id ?? null;
  const [items, setItems] = useState<OpsQueueItem[]>([]);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  const refresh = useCallback(async () => {
    const q = getOpsQueue(ownerId);
    const all = await q.all();
    setItems(all);
  }, [ownerId]);

  useEffect(() => {
    registerTextileOfflineRetry(ownerId);
    void refresh();
    const q = getOpsQueue(ownerId);
    const unsub = q.subscribe(() => void refresh());
    const onOnline = () => { setIsOnline(true); void q.drain().then(() => void refresh()); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    // Drain on mount if online
    if (navigator.onLine) void q.drain().then(() => void refresh());
    return () => { unsub(); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [ownerId, refresh]);

  const pending = items.filter((i) => i.status === 'pending' || i.status === 'failed' || i.status === 'in_flight');
  const dead = items.filter((i) => i.status === 'dead');
  const done = items.filter((i) => i.status === 'done');

  return {
    items,
    pending,
    dead,
    done,
    isOnline,
    refresh,
    drain: () => getOpsQueue(ownerId).drain().then(() => refresh()),
    remove: (id: string) => getOpsQueue(ownerId).remove(id).then(() => refresh()),
    clearDone: async () => { await getOpsQueue(ownerId).cleanupDone(0); await refresh(); },
  };
}
