import { useEffect, useState, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { useToast } from '../components/Toast';
import { pushSupport, subscribeToPush, unsubscribeFromPush } from '../push/subscribe';

/**
 * T-M13-016 — Citizen settings.
 *
 * The settings page is read-only for the citizen's profile
 * (it lives in `ProfilePage`) and writeable for:
 *  - Notification preferences (delegated to the M9 backend
 *    `/notifications/preferences` endpoints; this page is
 *    just a thin wrapper).
 *  - Push subscription toggle.
 *  - Theme (light only for now — dark mode is T-M15+).
 *  - Sign out.
 */
export default function SettingsPage(): JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [pushOn, setPushOn] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    const s = pushSupport();
    setPushOn(s.permission === 'granted');
  }, []);

  async function togglePush(): Promise<void> {
    setBusy(true);
    try {
      if (pushOn) {
        await unsubscribeFromPush();
        setPushOn(false);
        toast.show('Push notifications off', 'info');
      } else {
        const res = await subscribeToPush();
        if (res.ok) {
          setPushOn(true);
          toast.show('Push notifications on', 'success');
        } else if (res.reason === 'permission_denied') {
          toast.show('Notification permission denied in browser settings.', 'error');
        } else if (res.reason === 'unsupported') {
          toast.show('Push not supported in this browser.', 'error');
        } else {
          toast.show(`Could not enable push: ${res.reason ?? 'unknown'}`, 'error');
        }
      }
    } finally {
      setBusy(false);
    }
  }

  function onSignOut(): void {
    void unsubscribeFromPush().finally(() => {
      logout();
      void navigate('/');
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Notification preferences, push, and account.</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Account</h2>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-slate-500">Name</dt>
            <dd className="text-slate-900">{user?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Mobile</dt>
            <dd className="text-slate-900">{user?.mobile ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Push notifications</h2>
        <p className="mt-1 text-xs text-slate-500">
          We use push to tell you when a report changes status. You can disable it any time.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void togglePush()}
            aria-pressed={pushOn}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${pushOn ? 'bg-emerald-500' : 'bg-slate-300'} disabled:opacity-50`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${pushOn ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className="text-sm text-slate-700">{pushOn ? 'on' : 'off'}</span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Privacy &amp; legal</h2>
        <ul className="mt-2 space-y-1 text-sm text-emerald-700">
          <li><a href="/legal/privacy" className="underline">Privacy policy</a></li>
          <li><a href="/legal/terms" className="underline">Terms of use</a></li>
        </ul>
      </section>

      <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
        <h2 className="text-sm font-semibold text-rose-700">Sign out</h2>
        <p className="mt-1 text-xs text-rose-600">Ends your session on this device.</p>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-3 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100"
        >
          Sign out
        </button>
      </section>
    </div>
  );
}
