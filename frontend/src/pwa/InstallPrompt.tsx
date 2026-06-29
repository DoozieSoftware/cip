import { useEffect, useState, type JSX } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const STORAGE_KEY = 'cip.pwa.installPrompt.dismissedAt';
const DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return false;
    }
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) {
      return false;
    }
    return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function InstallPrompt(): JSX.Element | null {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      if (isDismissed()) {
        return;
      }
      setEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // If running as installed PWA, hide the prompt immediately.
    if (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || !visible || !event) {
    return null;
  }

  const onInstall = async (): Promise<void> => {
    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      // ignore — user can still install via the browser menu
    }
    setVisible(false);
    setEvent(null);
  };

  const onDismiss = (): void => {
    markDismissed();
    setVisible(false);
    setEvent(null);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Install Civic Intelligence Platform"
      className="fixed inset-x-0 bottom-20 z-40 mx-auto flex max-w-md items-start gap-3 rounded-xl border border-emerald-200 bg-white p-4 shadow-lg sm:bottom-6"
      style={{ left: '50%', transform: 'translateX(-50%)' }}
    >
      <div aria-hidden className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-emerald-600 text-white">
        📲
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900">Install the app</div>
        <p className="mt-0.5 text-xs text-slate-600">
          Add Civic Intelligence Platform to your home screen for offline report drafting and one-tap camera capture.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => { void onInstall(); }}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
          >
            Install
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

export default InstallPrompt;
