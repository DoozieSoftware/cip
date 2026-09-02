import { useEffect, useState, type JSX } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { useToast } from '../components/Toast';
import { pushSupport, subscribeToPush, unsubscribeFromPush } from '../push/subscribe';
import { useMessages, type Locale } from '../messages';
import { trackProductEvent } from '../../../shared/analytics';

const PUSH_SUBSCRIBE_URL = '/notifications/push/subscriptions';

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
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      setPushOn(false);
      return;
    }
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
      <header className="border-b border-[var(--color-border-faint)] pb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          {t('citizenServices')}
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
          {t('settings.title')}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          {t('settings.subtitle')}
        </p>
      </header>

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
          {t('settings.account')}
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-lg bg-[var(--color-surface-alt)] px-4 py-3">
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              {t('settings.name')}
            </dt>
            <dd className="mt-1 text-sm font-medium text-[var(--color-ink)]">
              {user?.name ?? '—'}
            </dd>
          </div>
          <div className="rounded-lg bg-[var(--color-surface-alt)] px-4 py-3">
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              {t('settings.mobile')}
            </dt>
            <dd className="mt-1 text-sm font-medium text-[var(--color-ink)]">
              {user?.mobile ?? '—'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
          {t('settings.pushNotifications')}
        </h2>
        <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
          {t('settings.pushDetail')}
        </p>
        <div className="mt-4 flex items-center justify-between gap-4 rounded-lg bg-[var(--color-surface-alt)] px-4 py-3">
          <span className="text-sm font-medium text-[var(--color-ink)]">
            {pushOn ? t('settings.pushOn') : t('settings.pushOff')}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void togglePush()}
            aria-pressed={pushOn}
            aria-label={t('settings.pushNotifications')}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-2 ${pushOn ? 'bg-[var(--color-ink)]' : 'bg-[var(--color-border)]'} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${pushOn ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <label
          htmlFor="citizen-language"
          className="text-sm font-semibold tracking-[-0.01em] text-[var(--color-ink)]"
        >
          {t('settings.language')}
        </label>
        <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
          {t('settings.languageDetail')}
        </p>
        <select
          id="citizen-language"
          value={locale}
          onChange={(event) => onLocaleChange(event.target.value as Locale)}
          className="mt-4 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-ink)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)] sm:max-w-xs"
        >
          <option value="en-IN">{t('settings.languageEnglish')}</option>
          <option value="kn-IN">{t('settings.languageKannada')}</option>
        </select>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
          {t('settings.privacyLegal')}
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          <li>
            <Link
              to="/citizen/legal/privacy"
              className="inline-flex min-h-11 items-center rounded-full border border-[var(--color-border)] bg-white px-4 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-canvas)]"
            >
              {t('settings.privacyPolicy')}
            </Link>
          </li>
          <li>
            <Link
              to="/citizen/legal/terms"
              className="inline-flex min-h-11 items-center rounded-full border border-[var(--color-border)] bg-white px-4 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-canvas)]"
            >
              {t('settings.termsOfUse')}
            </Link>
          </li>
        </ul>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
          {t('settings.signOut')}
        </h2>
        <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
          {t('settings.signOutDetail')}
        </p>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-white px-5 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-canvas)]"
        >
          {t('settings.signOut')}
        </button>
      </section>
    </div>
  );
}
