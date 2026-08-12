import { useEffect, useState, type JSX } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { useToast } from '../components/Toast';
import { pushSupport, subscribeToPush, unsubscribeFromPush } from '../push/subscribe';
import { useMessages, type Locale } from '../messages';
import { trackProductEvent } from '../../../shared/analytics';

/** VAPID public key comes from configuration, never hardcoded. */
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';
const PUSH_SUBSCRIBE_URL = '/notifications/push/subscriptions';

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
  const { t, locale, setLocale } = useMessages();
  const [pushOn, setPushOn] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    const s = pushSupport();
    if (!s.supported) {
      setPushOn(false);
      return;
    }
    // Reflect the *actual* push subscription, not just the browser
    // permission — permission can be "granted" while no subscription
    // exists, which made the toggle look stuck "on".
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => (reg ? reg.pushManager.getSubscription() : Promise.resolve(null)))
      .then((sub) => setPushOn(Boolean(sub)))
      .catch(() => setPushOn(false));
  }, []);

  async function togglePush(): Promise<void> {
    setBusy(true);
    try {
      if (pushOn) {
        await unsubscribeFromPush();
        setPushOn(false);
        toast.show(t('settings.pushOffToast'), 'info');
      } else {
        const res = await subscribeToPush({
          applicationServerKey: VAPID_PUBLIC_KEY,
          subscribeUrl: PUSH_SUBSCRIBE_URL,
        });
        if (res.ok) {
          setPushOn(true);
          toast.show(t('settings.pushOnToast'), 'success');
        } else if (res.reason === 'permission_denied') {
          toast.show(t('settings.permissionDeniedToast'), 'error');
        } else if (res.reason === 'unsupported') {
          toast.show(t('settings.unsupportedToast'), 'error');
        } else {
          toast.show(
            t('settings.enableFailedToast', { detail: res.detail ?? res.reason ?? 'unknown' }),
            'error',
          );
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

  function onLocaleChange(nextLocale: Locale): void {
    if (nextLocale !== locale) {
      trackProductEvent('accessibility_preference_changed', {
        preference: 'language',
        value: nextLocale,
      });
    }
    setLocale(nextLocale);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('settings.subtitle')}</p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">{t('settings.account')}</h2>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-slate-500">{t('settings.name')}</dt>
            <dd className="text-slate-900">{user?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">{t('settings.mobile')}</dt>
            <dd className="text-slate-900">{user?.mobile ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">{t('settings.pushNotifications')}</h2>
        <p className="mt-1 text-xs text-slate-500">{t('settings.pushDetail')}</p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void togglePush()}
            aria-pressed={pushOn}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${pushOn ? 'bg-blue-600' : 'bg-slate-300'} disabled:opacity-50`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${pushOn ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
          <span className="text-sm text-slate-700">
            {pushOn ? t('settings.pushOn') : t('settings.pushOff')}
          </span>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <label htmlFor="citizen-language" className="text-sm font-semibold text-slate-700">
          {t('settings.language')}
        </label>
        <p className="mt-1 text-xs text-slate-500">{t('settings.languageDetail')}</p>
        <select
          id="citizen-language"
          value={locale}
          onChange={(event) => onLocaleChange(event.target.value as Locale)}
          className="mt-3 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 sm:max-w-xs"
        >
          <option value="en-IN">{t('settings.languageEnglish')}</option>
          <option value="kn-IN">{t('settings.languageKannada')}</option>
        </select>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">{t('settings.privacyLegal')}</h2>
        <ul className="mt-2 space-y-1 text-sm text-blue-700">
          <li>
            <Link to="/citizen/legal/privacy" className="underline">
              {t('settings.privacyPolicy')}
            </Link>
          </li>
          <li>
            <Link to="/citizen/legal/terms" className="underline">
              {t('settings.termsOfUse')}
            </Link>
          </li>
        </ul>
      </section>

      <section className="rounded-lg border border-rose-200 bg-rose-50 p-4">
        <h2 className="text-sm font-semibold text-rose-700">{t('settings.signOut')}</h2>
        <p className="mt-1 text-xs text-rose-600">{t('settings.signOutDetail')}</p>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-3 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100"
        >
          {t('settings.signOut')}
        </button>
      </section>
    </div>
  );
}
