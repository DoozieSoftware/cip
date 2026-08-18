import { useEffect, useState, type FormEvent, type JSX } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { apiRequest, type ApiEnvelope } from '../../../auth/api';
import { Spinner } from '../../../shared/ui';
import {
  IconAlertCircle,
  IconBell,
  IconLock,
  IconMail,
  IconPhone,
  IconShield,
  IconUser,
} from '@tabler/icons-react';
import { useToast } from '../components/Toast';
import { pushSupport, subscribeToPush, unsubscribeFromPush } from '../push/subscribe';
import { useMessages } from '../messages';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';
const PUSH_SUBSCRIBE_URL = '/notifications/push/subscriptions';

interface ProfileData {
  id: string;
  name?: string | null;
  preferred_name?: string | null;
  mobile?: string | null;
  email?: string | null;
  preferred_locale?: 'en-IN' | 'kn-IN' | null;
  notification_channel?: 'sms' | 'push' | 'email' | null;
  roles: string[];
}

interface InfoRowProps {
  label: string;
  value: string | null | undefined;
}

function InfoRow({ label, value }: InfoRowProps): JSX.Element {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-4 py-3">
      <dt className="text-sm text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="text-sm font-medium text-[var(--color-ink)]">{value ?? '—'}</dd>
    </div>
  );
}

interface SectionProps {
  title: string;
  icon: JSX.Element;
  children: React.ReactNode;
}

function Section({ title, icon, children }: SectionProps): JSX.Element {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5">
      <div className="flex items-center gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-surface-alt)] text-[var(--color-text-subtle)]"
          aria-hidden
        >
          {icon}
        </span>
        <h2 className="text-sm font-medium text-[var(--color-ink)]">{title}</h2>
      </div>
      <div className="mt-3 divide-y divide-[var(--color-border-subtle)]">{children}</div>
    </div>
  );
}

export default function ProfilePage(): JSX.Element {
  const { user } = useAuth();
  const { t, locale, setLocale } = useMessages();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [preferredName, setPreferredName] = useState('');
  const [email, setEmail] = useState('');
  const [profileLocale, setProfileLocale] = useState<'en-IN' | 'kn-IN'>(locale);
  const [notificationChannel, setNotificationChannel] = useState<'sms' | 'push' | 'email'>('sms');
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<ProfileData>>('/auth/me');
      return res.data;
    },
  });

  useEffect(() => {
    if (!me.data) return;
    setPreferredName(me.data.preferred_name ?? '');
    setEmail(me.data.email ?? '');
    setProfileLocale(me.data.preferred_locale ?? locale);
    setNotificationChannel(me.data.notification_channel ?? 'sms');
  }, [me.data, locale]);

  useEffect(() => {
    const support = pushSupport();
    if (!support.supported || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      setPushOn(false);
      return;
    }

    navigator.serviceWorker
      .getRegistration()
      .then((registration) =>
        registration ? registration.pushManager.getSubscription() : Promise.resolve(null),
      )
      .then((subscription) => setPushOn(Boolean(subscription)))
      .catch(() => setPushOn(false));
  }, []);

  const profileNeedsCompletion =
    me.data != null &&
    (!me.data.preferred_name || !me.data.preferred_locale || !me.data.notification_channel);

  async function saveProfile(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const response = await apiRequest<ApiEnvelope<ProfileData>>('/auth/profile', {
        method: 'PATCH',
        body: {
          preferred_name: preferredName.trim() || null,
          email: email.trim() || null,
          preferred_locale: profileLocale,
          notification_channel: notificationChannel,
        },
      });
      queryClient.setQueryData(['me'], response.data);
      setLocale(profileLocale);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function togglePush(): Promise<void> {
    setPushBusy(true);
    try {
      if (pushOn) {
        await unsubscribeFromPush();
        setPushOn(false);
        toast.show(t('settings.pushOffToast'), 'info');
        return;
      }

      const result = await subscribeToPush({
        applicationServerKey: VAPID_PUBLIC_KEY,
        subscribeUrl: PUSH_SUBSCRIBE_URL,
      });

      if (result.ok) {
        setPushOn(true);
        toast.show(t('settings.pushOnToast'), 'success');
      } else if (result.reason === 'permission_denied') {
        toast.show(t('settings.permissionDeniedToast'), 'error');
      } else if (result.reason === 'unsupported') {
        toast.show(t('settings.unsupportedToast'), 'error');
      } else {
        toast.show(
          t('settings.enableFailedToast', { detail: result.detail ?? result.reason ?? 'unknown' }),
          'error',
        );
      }
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-5 border-b border-[var(--color-border-faint)] pb-7">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-subtle)]">
            {t('citizenServices')}
          </p>
          <h1 className="mt-2 text-[2rem] font-normal leading-[1.05] tracking-[-0.035em] sm:text-4xl">
            {t('profile.title')}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-6 text-[var(--color-text-secondary)]">
            {t('profile.subtitle')}
          </p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#d8d6cf] bg-[#faf9f6]">
          <IconUser className="h-5 w-5" stroke={1.6} />
        </span>
      </header>

      <div className="mx-auto max-w-3xl space-y-4">
        {me.isLoading ? (
          <div className="flex justify-center py-20">
            <Spinner label={t('profile.loading')} />
          </div>
        ) : me.isError ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--color-surface-alt)]">
              <IconAlertCircle className="h-6 w-6 text-[var(--color-text-subtle)]" stroke={1.6} />
            </div>
            <p className="text-sm font-medium text-[var(--color-ink)]">{t('profile.loadError')}</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {t('profile.loadErrorDetail')}
            </p>
            <button
              type="button"
              onClick={() => {
                void me.refetch();
              }}
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 text-sm font-medium text-[var(--color-ink)] transition hover:border-black/30 active:bg-[#faf9f6]"
            >
              {t('common.retry')}
            </button>
          </div>
        ) : me.data == null ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--color-surface-alt)]">
              <IconUser className="h-6 w-6 text-[var(--color-text-subtle)]" stroke={1.6} />
            </div>
            <p className="text-sm font-medium text-[var(--color-ink)]">{t('profile.empty')}</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {t('profile.emptyDetail')}
            </p>
            <button
              type="button"
              onClick={() => {
                void me.refetch();
              }}
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 text-sm font-medium text-[var(--color-ink)] transition hover:border-black/30 active:bg-[#faf9f6]"
            >
              {t('common.retry')}
            </button>
          </div>
        ) : (
          <>
            <form
              onSubmit={(event) => void saveProfile(event)}
              className="rounded-2xl border border-[var(--color-ink)]/15 bg-[var(--color-surface-alt)] p-5"
              aria-labelledby="profile-completion-title"
            >
              <h2
                id="profile-completion-title"
                className="text-base font-semibold text-[var(--color-ink)]"
              >
                {profileNeedsCompletion ? t('profile.completeTitle') : t('profile.editTitle')}
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                {profileNeedsCompletion ? t('profile.completeDetail') : t('profile.editDetail')}
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-[var(--color-ink)]">
                  {t('profile.preferredName')}
                  <input
                    value={preferredName}
                    onChange={(event) => setPreferredName(event.target.value)}
                    autoComplete="nickname"
                    maxLength={120}
                    className="mt-1 min-h-11 w-full rounded-lg border border-black/15 bg-white px-3 text-base font-normal"
                  />
                </label>
                <label className="text-sm font-medium text-[var(--color-ink)]">
                  {t('profile.emailForNotifications')}{' '}
                  <span className="font-normal text-[var(--color-text-tertiary)]">
                    ({t('common.optional')})
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    className="mt-1 min-h-11 w-full rounded-lg border border-black/15 bg-white px-3 text-base font-normal"
                  />
                </label>
                <label className="text-sm font-medium text-[var(--color-ink)]">
                  {t('profile.language')}
                  <select
                    value={profileLocale}
                    onChange={(event) => setProfileLocale(event.target.value as 'en-IN' | 'kn-IN')}
                    className="mt-1 min-h-11 w-full rounded-lg border border-black/15 bg-white px-3 text-base font-normal"
                  >
                    <option value="en-IN">{t('profile.languageEnglish')}</option>
                    <option value="kn-IN">{t('profile.languageKannada')}</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-[var(--color-ink)]">
                  {t('profile.notificationChannel')}
                  <select
                    value={notificationChannel}
                    onChange={(event) =>
                      setNotificationChannel(event.target.value as 'sms' | 'push' | 'email')
                    }
                    className="mt-1 min-h-11 w-full rounded-lg border border-black/15 bg-white px-3 text-base font-normal"
                  >
                    <option value="sms">{t('profile.channelSms')}</option>
                    <option value="push">{t('profile.channelPush')}</option>
                    <option value="email">{t('profile.channelEmail')}</option>
                  </select>
                </label>
              </div>
              {saveError ? (
                <p role="alert" className="mt-3 text-sm text-red-700">
                  {saveError}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={saving || preferredName.trim().length === 0}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-ink)] px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? t('profile.saving') : t('profile.save')}
              </button>
            </form>

            <Section
              title={t('profile.personalInfo')}
              icon={<IconUser className="h-4 w-4" stroke={1.6} />}
            >
              <InfoRow
                label={t('profile.fullName')}
                value={me.data?.preferred_name ?? me.data?.name}
              />
              <InfoRow label={t('profile.mobileNumber')} value={me.data?.mobile ?? user?.mobile} />
            </Section>

            <Section
              title={t('profile.contact')}
              icon={<IconMail className="h-4 w-4" stroke={1.6} />}
            >
              <InfoRow label={t('profile.emailAddress')} value={me.data?.email} />
            </Section>

            <Section
              title={t('profile.accessRoles')}
              icon={<IconShield className="h-4 w-4" stroke={1.6} />}
            >
              {(me.data?.roles ?? []).length === 0 ? (
                <p className="py-3 text-sm text-[var(--color-text-tertiary)]">
                  {t('profile.noRoles')}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 py-3">
                  {(me.data?.roles ?? []).map((r) => (
                    <span
                      key={r}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-alt)] px-3 py-1 text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]"
                    >
                      <IconShield className="h-3.5 w-3.5" stroke={1.7} aria-hidden />
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </Section>

            <Section
              title={t('settings.pushNotifications')}
              icon={<IconBell className="h-4 w-4" stroke={1.6} />}
            >
              <div className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    {pushOn ? t('settings.pushOn') : t('settings.pushOff')}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {t('settings.pushDetail')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pushBusy}
                  onClick={() => void togglePush()}
                  aria-label={t('settings.pushNotifications')}
                  aria-pressed={pushOn}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-2 ${pushOn ? 'bg-[var(--color-ink)]' : 'bg-[#d8d6cf]'} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${pushOn ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
            </Section>

            <Section
              title={t('settings.privacyLegal')}
              icon={<IconLock className="h-4 w-4" stroke={1.6} />}
            >
              <div className="flex flex-wrap gap-x-6 gap-y-1 py-2">
                <Link
                  to="/citizen/legal/privacy"
                  className="inline-flex min-h-11 items-center text-sm text-[var(--color-ink)] underline underline-offset-4"
                >
                  {t('settings.privacyPolicy')}
                </Link>
                <Link
                  to="/citizen/legal/terms"
                  className="inline-flex min-h-11 items-center text-sm text-[var(--color-ink)] underline underline-offset-4"
                >
                  {t('settings.termsOfUse')}
                </Link>
              </div>
            </Section>

            <div className="rounded-2xl border border-[#d8cfae] bg-[#f1ead4] p-5">
              <div className="flex items-start gap-4">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e8dfc0] text-[#746f5e]"
                  aria-hidden
                >
                  <IconPhone className="h-4 w-4" stroke={1.6} />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    {t('profile.needToUpdate')}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-subtle)]">
                    {t('profile.updateDetail')}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
