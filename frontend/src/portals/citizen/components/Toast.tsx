import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode, type JSX } from 'react';
import { cx } from '../../moderator/design/cx';

type ToastKind = 'info' | 'success' | 'error';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  ttl: number;
}

interface ToastApi {
  show: (message: string, kind?: ToastKind, ttl?: number) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, kind: ToastKind = 'info', ttl = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message, ttl }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ttl);
  }, []);

  const api = useMemo<ToastApi>(() => ({ show }), [show]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cx(
              'pointer-events-auto max-w-sm rounded-md border px-4 py-2 text-sm shadow-lg',
              t.kind === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
              t.kind === 'error' && 'border-rose-200 bg-rose-50 text-rose-900',
              t.kind === 'info' && 'border-slate-200 bg-white text-slate-900',
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  // No-op fallback for tests / unmounted contexts.
  return useMemo<ToastApi>(
    () => ctx ?? { show: () => {} },
    [ctx],
  );
}

// Re-export the no-op toast for places that need to render without provider.
export function NoopToast({ message }: { message: string }): JSX.Element {
  return <div role="status">{message}</div>;
}

// Helps consumers that mount the provider themselves and need to test the
// auto-dismiss behavior.
export function __useToastInternalForTest(setToasts: (fn: (prev: Toast[]) => Toast[]) => void): void {
  useEffect(() => {
    setToasts(() => []);
  }, [setToasts]);
}
