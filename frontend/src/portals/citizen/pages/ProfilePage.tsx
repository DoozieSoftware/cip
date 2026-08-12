import { type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../auth/AuthContext';
import { apiRequest, type ApiEnvelope } from '../../../auth/api';
import { Spinner } from '../../../shared/ui';
import {
  IconUser,
  IconMail,
  IconPhone,
  IconShield,
  IconLogout,
  IconAlertCircle,
} from '@tabler/icons-react';
import { useMessages } from '../messages';

interface ProfileData {
  id: string;
  name?: string | null;
  mobile?: string | null;
  email?: string | null;
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
  const { t } = useMessages();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<ProfileData>>('/auth/me');
      return res.data;
    },
  });

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

      <main className="mx-auto max-w-3xl space-y-4 pb-12">
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
            <Section
              title={t('profile.personalInfo')}
              icon={<IconUser className="h-4 w-4" stroke={1.6} />}
            >
              <InfoRow label={t('profile.fullName')} value={me.data?.name} />
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
                  <p className="mt-1 text-sm leading-relaxed text-[#686762]">
                    {t('profile.updateDetail')}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 text-sm font-medium text-[var(--color-ink)] transition hover:border-black/30 active:bg-[#faf9f6] sm:w-auto"
            >
              <IconLogout className="h-4 w-4" stroke={1.6} aria-hidden />
              {t('common.signOut')}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
