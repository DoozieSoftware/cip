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
  IconMapPin,
  IconPhone,
  IconShield,
  IconUser,
} from '@tabler/icons-react';
import { reverseGeocode } from '../../../shared/geo/reverseGeocode';
import { useToast } from '../components/Toast';
import { pushSupport, subscribeToPush, unsubscribeFromPush } from '../push/subscribe';
import { useMessages } from '../messages';
import {
  readDefaultAddress,
  validateCitizenContact,
  writeDefaultAddress,
  type CitizenContactErrors,
} from '../api/profile';

const PUSH_SUBSCRIBE_URL = '/notifications/push/subscriptions';

interface ProfileData {
  id: string;
  name?: string | null;
  preferred_name?: string | null;
  mobile?: string | null;
  email?: string | null;
  default_address?: string | null;
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
    <div className="flex min-h-11 items-center justify-between gap-4 py-3">
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
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-surface-alt)] text-[var(--color-text-subtle)]"
          aria-hidden
        >
          {icon}
        </span>
        <h2 className="text-sm font-medium text-[var(--color-ink)]">{title}</h2>
      </div>
      <div className="mt-4 divide-y divide-[var(--color-border-subtle)]">{children}</div>
    </div>
  );
}

export default function ProfilePage(): JSX.Element {
  const { user } = useAuth();
  const { t, locale, setLocale } = useMessages();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [preferredName, setPreferredName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [defaultAddress, setDefaultAddress] = useState('');
  const [contactErrors, setContactErrors] = useState<CitizenContactErrors>({});
  const [profileLocale, setProfileLocale] = useState<'en-IN' | 'kn-IN'>(locale);
  const [notificationChannel, setNotificationChannel] = useState<'sms' | 'push' | 'email'>('sms');
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [locatingAddress, setLocatingAddress] = useState(false);
  const [addressLocationMessage, setAddressLocationMessage] = useState<string | null>(null);
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
    setFullName(me.data.name ?? '');
    setEmail(me.data.email ?? '');
    setPhone(me.data.mobile ?? '');
    setDefaultAddress(me.data.default_address ?? readDefaultAddress());
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
    // Same contact rules as the booking form (#12).
    const errors = validateCitizenContact({
      fullName,
      email,
      phone,
      defaultAddress,
    });
    setContactErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await apiRequest<ApiEnvelope<ProfileData>>('/auth/profile', {
        method: 'PATCH',
        body: {
          name: fullName.trim() || null,
          preferred_name: preferredName.trim() || null,
          email: email.trim() || null,
          mobile: phone.trim(),
          // Forward-compatible: ignored by backends without the column, picked
          // up once the backend half of #12 lands. localStorage is the fallback.
          default_address: defaultAddress.trim() || null,
          preferred_locale: profileLocale,
          notification_channel: notificationChannel,
        },
      });
      writeDefaultAddress(defaultAddress.trim());
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
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border-faint)] pb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            {t('citizenServices')}
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
            {t('profile.title')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
            {t('profile.subtitle')}
          </p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)]">
          <IconUser className="h-5 w-5 text-[var(--color-text-subtle)]" stroke={1.6} />
        </span>
      </header>

      <div className="mx-auto max-w-3xl space-y-6">
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
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-5 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-canvas)]"
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
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-5 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-canvas)]"
            >
              {t('common.retry')}
            </button>
          </div>
        ) : (
          <>
            <form
              onSubmit={(event) => void saveProfile(event)}
              noValidate
              className="rounded-xl bg-[var(--color-surface-alt)] p-6 shadow-sm ring-1 ring-black/5"
              aria-labelledby="profile-completion-title"
            >
              <h2
                id="profile-completion-title"
                className="text-sm font-semibold tracking-[-0.01em] text-[var(--color-ink)]"
              >
                {profileNeedsCompletion ? t('profile.completeTitle') : t('profile.editTitle')}
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                {profileNeedsCompletion ? t('profile.completeDetail') : t('profile.editDetail')}
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-[var(--color-ink)]">
                  {t('profile.fullName')}
                  <input
                    value={fullName}
                    onChange={(event) => {
                      setFullName(event.target.value);
                      if (contactErrors.fullName) {
                        setContactErrors((prev) => ({ ...prev, fullName: undefined }));
                      }
                    }}
                    onBlur={() => {
                      const next = validateCitizenContact({
                        fullName,
                        email,
                        phone,
                        defaultAddress,
                      });
                      setContactErrors((prev) => ({ ...prev, fullName: next.fullName }));
                    }}
                    autoComplete="name"
                    maxLength={255}
                    placeholder={t('profile.fullName')}
                    aria-invalid={Boolean(contactErrors.fullName)}
                    className="mt-1 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
                  />
                  {contactErrors.fullName ? (
                    <span
                      role="alert"
                      className="mt-1 block text-xs font-medium text-[var(--color-danger)]"
                    >
                      {contactErrors.fullName}
                    </span>
                  ) : null}
                </label>
                <label className="text-sm font-medium text-[var(--color-ink)]">
                  {t('profile.preferredName')}
                  <input
                    value={preferredName}
                    onChange={(event) => setPreferredName(event.target.value)}
                    autoComplete="nickname"
                    maxLength={120}
                    placeholder={t('profile.preferredName')}
                    className="mt-1 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
                  />
                </label>
                <label className="text-sm font-medium text-[var(--color-ink)]">
                  {t('profile.mobileNumber')}
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      if (contactErrors.phone) {
                        setContactErrors((prev) => ({ ...prev, phone: undefined }));
                      }
                    }}
                    autoComplete="tel"
                    placeholder="+91 98765 43210"
                    aria-invalid={Boolean(contactErrors.phone)}
                    onBlur={() => {
                      const next = validateCitizenContact({
                        fullName,
                        email,
                        phone,
                        defaultAddress,
                      });
                      setContactErrors((prev) => ({ ...prev, phone: next.phone }));
                    }}
                    className="mt-1 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
                  />
                  {contactErrors.phone ? (
                    <span
                      role="alert"
                      className="mt-1 block text-xs font-medium text-[var(--color-danger)]"
                    >
                      {contactErrors.phone}
                    </span>
                  ) : null}
                </label>
                <label className="text-sm font-medium text-[var(--color-ink)]">
                  {t('profile.emailForNotifications')}{' '}
                  <span className="font-normal text-[var(--color-text-tertiary)]">
                    ({t('common.optional')})
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (contactErrors.email) {
                        setContactErrors((prev) => ({ ...prev, email: undefined }));
                      }
                    }}
                    autoComplete="email"
                    placeholder="you@example.com"
                    aria-invalid={Boolean(contactErrors.email)}
                    onBlur={() => {
                      const next = validateCitizenContact({
                        fullName,
                        email,
                        phone,
                        defaultAddress,
                      });
                      setContactErrors((prev) => ({ ...prev, email: next.email }));
                    }}
                    className="mt-1 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
                  />
                  {contactErrors.email ? (
                    <span
                      role="alert"
                      className="mt-1 block text-xs font-medium text-[var(--color-danger)]"
                    >
                      {contactErrors.email}
                    </span>
                  ) : null}
                </label>
                <label className="text-sm font-medium text-[var(--color-ink)] sm:col-span-2">
                  {t('profile.defaultAddress')}{' '}
                  <span className="font-normal text-[var(--color-text-tertiary)]">
                    ({t('common.optional')})
                  </span>
                  <textarea
                    value={defaultAddress}
                    onChange={(event) => {
                      setDefaultAddress(event.target.value);
                      if (contactErrors.defaultAddress) {
                        setContactErrors((prev) => ({ ...prev, defaultAddress: undefined }));
                      }
                    }}
                    rows={2}
                    autoComplete="street-address"
                    placeholder={t('profile.defaultAddressPlaceholder')}
                    aria-invalid={Boolean(contactErrors.defaultAddress)}
                    aria-describedby="profile-address-hint"
                    onBlur={() => {
                      const next = validateCitizenContact({
                        fullName,
                        email,
                        phone,
                        defaultAddress,
                      });
                      setContactErrors((prev) => ({
                        ...prev,
                        defaultAddress: next.defaultAddress,
                      }));
                    }}
                    className="mt-1 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
                  />
                  <span
                    id="profile-address-hint"
                    className="mt-1 block text-xs font-normal text-[var(--color-text-secondary)]"
                  >
                    {t('profile.defaultAddressHint')}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={locatingAddress}
                      onClick={() => {
                        if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
                          setAddressLocationMessage(t('gps.notSupported'));
                          return;
                        }
                        setLocatingAddress(true);
                        setAddressLocationMessage(t('gps.locating'));
                        navigator.geolocation.getCurrentPosition(
                          (position) => {
                            const { latitude, longitude } = position.coords;
                            void reverseGeocode(latitude, longitude).then((result) => {
                              setLocatingAddress(false);
                              if (result.label !== '') {
                                setDefaultAddress(result.label);
                                if (contactErrors.defaultAddress) {
                                  setContactErrors((prev) => ({
                                    ...prev,
                                    defaultAddress: undefined,
                                  }));
                                }
                                setAddressLocationMessage(t('profile.addressFilledFromLocation'));
                              } else {
                                setAddressLocationMessage(t('profile.addressLookupFailed'));
                              }
                            });
                          },
                          (error) => {
                            setLocatingAddress(false);
                            if (error.code === 1) setAddressLocationMessage(t('gps.blocked'));
                            else if (error.code === 3) setAddressLocationMessage(t('gps.timeout'));
                            else setAddressLocationMessage(t('gps.unavailable'));
                          },
                          { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
                        );
                      }}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-4 text-xs font-medium text-[var(--color-ink)] disabled:opacity-50"
                    >
                      <IconMapPin className="h-4 w-4" stroke={1.6} aria-hidden="true" />
                      {t('gps.useMyLocation')}
                    </button>
                    {addressLocationMessage ? (
                      <span role="status" className="text-xs text-[var(--color-text-secondary)]">
                        {addressLocationMessage}
                      </span>
                    ) : null}
                  </span>
                  {contactErrors.defaultAddress ? (
                    <span
                      role="alert"
                      className="mt-1 block text-xs font-medium text-[var(--color-danger)]"
                    >
                      {contactErrors.defaultAddress}
                    </span>
                  ) : null}
                </label>
                <label className="text-sm font-medium text-[var(--color-ink)]">
                  {t('profile.language')}
                  <select
                    value={profileLocale}
                    onChange={(event) => setProfileLocale(event.target.value as 'en-IN' | 'kn-IN')}
                    className="mt-1 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-ink)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
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
                    className="mt-1 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-ink)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
                  >
                    <option value="sms">{t('profile.channelSms')}</option>
                    <option value="push">{t('profile.channelPush')}</option>
                    <option value="email">{t('profile.channelEmail')}</option>
                  </select>
                </label>
              </div>
              {saveError ? (
                <p role="alert" className="mt-3 text-sm font-medium text-[var(--color-danger)]">
                  {saveError}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={saving}
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-ink)] px-5 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
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
              <InfoRow
                label={t('profile.defaultAddress')}
                value={(() => {
                  const stored = me.data?.default_address ?? readDefaultAddress();
                  return stored.trim().length > 0 ? stored : undefined;
                })()}
              />
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
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-2 ${pushOn ? 'bg-[var(--color-ink)]' : 'bg-[var(--color-border)]'} disabled:cursor-not-allowed disabled:opacity-50`}
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
                  className="inline-flex min-h-11 items-center text-sm text-[var(--color-ink)] underline underline-offset-4 hover:text-[var(--color-ink-soft)]"
                >
                  {t('settings.privacyPolicy')}
                </Link>
                <Link
                  to="/citizen/legal/terms"
                  className="inline-flex min-h-11 items-center text-sm text-[var(--color-ink)] underline underline-offset-4 hover:text-[var(--color-ink-soft)]"
                >
                  {t('settings.termsOfUse')}
                </Link>
              </div>
            </Section>

            <div className="rounded-xl bg-[var(--color-surface-alt)] p-6 shadow-sm ring-1 ring-black/5">
              <div className="flex items-start gap-4">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[var(--color-text-subtle)] ring-1 ring-black/5"
                  aria-hidden
                >
                  <IconPhone className="h-4 w-4" stroke={1.6} />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    {t('profile.needToUpdate')}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">
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
