import { Link } from 'react-router-dom';
import { type JSX } from 'react';
import {
  IconAlertCircle,
  IconArrowUpRight,
  IconBell,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconFileDescription,
  IconMapPin,
  IconPlus,
  IconRefresh,
  IconShieldCheck,
  IconWifiOff,
} from '@tabler/icons-react';
import { useAuth } from '../../../auth/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, type ApiEnvelope } from '../../../auth/api';
import { Spinner, EmptyState, ErrorState } from '../../../shared/ui';
import { ApiError } from '../../../shared/api/errors';
import { getQueue } from '../offline/queue';
import { useCitizenReports } from '../api/client';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useMessages } from '../messages';

interface ProfileResponse {
  id: string;
  name?: string | null;
  mobile?: string | null;
  email?: string | null;
  roles: string[];
}

export default function HomePage(): JSX.Element {
  const { user } = useAuth();
  const { t } = useMessages();
  const online = useOnlineStatus();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<ProfileResponse>>('/auth/me');
      return res.data;
    },
  });
  const queue = useQuery({
    queryKey: ['citizen', user?.id, 'queue', 'size'],
    queryFn: async () => getQueue(user?.id).size(),
    refetchInterval: 5_000,
  });
  const reports = useCitizenReports(1, 100);

  if (!online && !reports.data) {
    return (
      <div className="space-y-8">
        <header className="flex items-start justify-between gap-5 border-b border-[var(--color-border-faint)] pb-7">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-subtle)]">
              {t('citizenServices')}
            </p>
            <h1 className="mt-2 text-[2rem] font-normal leading-[1.05] tracking-[-0.035em] sm:text-4xl">
              {t('home.greeting', { name: user?.name?.split(' ')[0] ?? t('common.citizen') })}
            </h1>
          </div>
        </header>
        <main className="mx-auto flex max-w-3xl justify-center py-20">
          <div className="flex flex-col items-center px-6 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-surface-alt)]">
              <IconWifiOff
                className="h-7 w-7 text-[var(--color-text-subtle)]"
                stroke={1.5}
                aria-hidden
              />
            </span>
            <p className="mt-4 text-base font-medium text-[var(--color-ink)]">
              {t('home.offline.title')}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-subtle)]">
              {t('home.offline.detail')}
            </p>
            <button
              type="button"
              onClick={() => {
                void reports.refetch();
              }}
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-black/15 bg-white px-5 text-sm font-medium transition hover:border-black/30"
            >
              <IconRefresh className="h-4 w-4" stroke={1.6} aria-hidden />
              {t('home.offline.action')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (reports.isError && !reports.data) {
    const err = reports.error;
    const isAuthError = err instanceof ApiError && err.status === 401;

    if (isAuthError) {
      return (
        <div className="space-y-8">
          <header className="flex items-start justify-between gap-5 border-b border-[var(--color-border-faint)] pb-7">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-subtle)]">
                {t('citizenServices')}
              </p>
              <h1 className="mt-2 text-[2rem] font-normal leading-[1.05] tracking-[-0.035em] sm:text-4xl">
                {t('home.greeting', { name: user?.name?.split(' ')[0] ?? t('common.citizen') })}
              </h1>
            </div>
          </header>
          <main className="mx-auto flex max-w-3xl justify-center py-20">
            <div className="flex flex-col items-center px-6 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                <IconAlertCircle
                  className="h-7 w-7 text-[var(--color-text-subtle)]"
                  stroke={1.5}
                  aria-hidden
                />
              </span>
              <p className="mt-4 text-base font-medium text-[var(--color-ink)]">
                {t('home.session.title')}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-subtle)]">
                {t('home.session.detail')}
              </p>
              <button
                type="button"
                onClick={() => {
                  window.location.assign('/citizen/login');
                }}
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-black/15 bg-white px-5 text-sm font-medium transition hover:border-black/30"
              >
                {t('home.session.action')}
              </button>
            </div>
          </main>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <header className="flex items-start justify-between gap-5 border-b border-[var(--color-border-faint)] pb-7">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-subtle)]">
              {t('citizenServices')}
            </p>
            <h1 className="mt-2 text-[2rem] font-normal leading-[1.05] tracking-[-0.035em] sm:text-4xl">
              {t('home.greeting', { name: user?.name?.split(' ')[0] ?? t('common.citizen') })}
            </h1>
          </div>
        </header>
        <main className="mx-auto flex max-w-3xl justify-center py-20">
          <ErrorState
            title={t('home.error.title')}
            description={t('home.error.detail')}
            error={err instanceof Error ? err : null}
            action={
              <button
                type="button"
                onClick={() => {
                  void reports.refetch();
                }}
                className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-full border border-black/15 bg-white px-5 text-sm font-medium transition hover:border-black/30"
              >
                <IconRefresh className="h-4 w-4" stroke={1.6} aria-hidden />
                {t('home.error.action')}
              </button>
            }
          />
        </main>
      </div>
    );
  }

  if (reports.isLoading && !reports.data) {
    return (
      <div className="space-y-8">
        <header className="flex items-start justify-between gap-5 border-b border-[var(--color-border-faint)] pb-7">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-subtle)]">
              {t('citizenServices')}
            </p>
            <h1 className="mt-2 text-[2rem] font-normal leading-[1.05] tracking-[-0.035em] sm:text-4xl">
              {t('home.greeting', { name: user?.name?.split(' ')[0] ?? t('common.citizen') })}
            </h1>
          </div>
        </header>
        <main className="flex min-h-[40vh] items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4 text-center">
            <Spinner label={t('spinner.loadingYourDashboard')} />
            <p className="text-sm text-[var(--color-text-subtle)]">
              {t('spinner.loadingYourDashboard')}
            </p>
          </div>
        </main>
      </div>
    );
  }

  const queueSize = queue.data ?? 0;
  const reportRows = reports.data?.data ?? [];
  const total = reports.data?.meta.total ?? reportRows.length;
  const resolved = reportRows.filter((report) =>
    ['resolved', 'verified', 'closed'].includes(report.status.code),
  ).length;
  const active = reportRows.filter(
    (report) =>
      !['resolved', 'verified', 'closed', 'rejected', 'merged'].includes(report.status.code),
  ).length;
  const recent = reportRows.slice(0, 3);

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-5 border-b border-[var(--color-border-faint)] pb-7">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-subtle)]">
            {t('citizenServices')}
          </p>
          <h1 className="mt-2 text-[2rem] font-normal leading-[1.05] tracking-[-0.035em] sm:text-4xl">
            {t('home.greeting', { name: user?.name?.split(' ')[0] ?? t('common.citizen') })}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-6 text-[var(--color-text-secondary)]">
            {t('home.tagline')}
          </p>
        </div>
        <Link
          to="/citizen/notifications"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#d8d6cf] bg-[#faf9f6] transition hover:bg-white"
          aria-label={t('nav.notifications')}
        >
          <IconBell className="h-5 w-5" stroke={1.6} />
        </Link>
      </header>

      {reports.isError && reports.data && (
        <div
          className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          role="alert"
        >
          <IconAlertCircle className="h-5 w-5 shrink-0" stroke={1.6} aria-hidden />
          <span className="flex-1">{t('home.stale.message')}</span>
          <button
            type="button"
            onClick={() => {
              void reports.refetch();
            }}
            className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
          >
            <IconRefresh className="h-4 w-4" stroke={1.6} aria-hidden />
            {t('home.stale.retry')}
          </button>
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
          <Link
            to="/citizen/submit"
            className="group flex min-h-36 items-end justify-between gap-5 bg-white p-6 text-[var(--color-ink)] transition-colors hover:bg-[var(--color-ink-soft)] hover:text-white sm:p-7"
          >
            <div>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-ink)] text-white transition-colors group-hover:bg-white group-hover:text-[var(--color-ink)]">
                <IconPlus className="h-5 w-5" stroke={1.8} />
              </span>
              <h2 className="mt-5 text-2xl font-normal tracking-[-0.025em]">
                {t('home.fileNewReport')}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)] transition-colors group-hover:text-white/65">
                {t('home.fileNewReportSub')}
              </p>
            </div>
            <IconArrowUpRight
              className="h-6 w-6 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              stroke={1.5}
            />
          </Link>
          <div className="grid grid-cols-4 border-t border-[var(--color-border-subtle)]">
            {[
              { label: t('home.stats.filed'), value: total },
              { label: t('home.stats.active'), value: active },
              { label: t('home.stats.resolved'), value: resolved },
              { label: t('home.stats.offline'), value: queueSize },
            ].map((s) => (
              <div
                key={s.label}
                className="border-r border-[var(--color-border-subtle)] px-2 py-4 text-center last:border-r-0 sm:px-4"
              >
                <p className="font-mono text-xl text-[var(--color-ink)]">{s.value}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-[#e9e8e2] p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
            {t('home.servicePromise')}
          </p>
          <h2 className="mt-4 text-2xl font-normal leading-tight tracking-[-0.025em]">
            {t('home.oneRecord')}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#686762]">{t('home.recordDetail')}</p>
          <Link
            to="/citizen/reports"
            className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full border border-black/15 bg-white px-5 text-sm font-medium transition hover:border-black/30"
          >
            {t('home.viewMyReports')}
            <IconChevronRight className="h-4 w-4" stroke={1.6} />
          </Link>
        </div>
      </section>

      {queueSize > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-[#d8cfae] bg-[#f1ead4] px-5 py-4">
          <IconWifiOff className="h-5 w-5 shrink-0" stroke={1.6} />
          <div className="flex-1">
            <p className="text-sm font-medium">
              {t('home.offlineSync', { count: queueSize, plural: queueSize > 1 ? 's' : '' })}
            </p>
            <p className="text-xs text-[#746f5e]">{t('home.offlineSyncDetail')}</p>
          </div>
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-black/10 bg-white">
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-5 py-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                {t('home.recentActivity')}
              </p>
              <h2 className="mt-1 text-lg font-medium tracking-[-0.015em]">
                {t('home.yourLatestReports')}
              </h2>
            </div>
            <IconFileDescription className="h-5 w-5 text-[var(--color-text-subtle)]" stroke={1.5} />
          </div>
          {reports.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner label={t('home.loadingReports')} />
            </div>
          ) : recent.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title={t('home.noReportsYet')}
                description={t('home.empty.description')}
                action={
                  <Link
                    to="/citizen/submit"
                    className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-full border border-black/15 bg-white px-5 text-sm font-medium transition hover:border-black/30"
                  >
                    <IconPlus className="h-4 w-4" stroke={1.7} />
                    {t('home.empty.action')}
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border-subtle)]">
              {recent.map((report) => (
                <Link
                  key={report.id}
                  to={`/citizen/reports/${report.id}`}
                  className="group flex min-h-16 items-center gap-3 px-5 py-3 transition hover:bg-[#faf9f6]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                    {['resolved', 'verified', 'closed'].includes(report.status.code) ? (
                      <IconCheck className="h-4 w-4" stroke={1.8} />
                    ) : (
                      <IconClock className="h-4 w-4" stroke={1.7} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{report.title}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
                      {report.status.name}
                    </p>
                  </div>
                  <IconChevronRight
                    className="h-4 w-4 text-[var(--color-border-strong)] transition-transform group-hover:translate-x-0.5"
                    stroke={1.5}
                  />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-black/10 bg-white">
          <div className="border-b border-[var(--color-border-subtle)] px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
              {t('home.fromReportToResolution')}
            </p>
            <h2 className="mt-1 text-lg font-medium tracking-[-0.015em]">
              {t('home.whatHappensNext')}
            </h2>
          </div>
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {[
              {
                n: '01',
                title: t('home.step.evidence.title'),
                desc: t('home.step.evidence.desc'),
                icon: IconShieldCheck,
              },
              {
                n: '02',
                title: t('home.step.routing.title'),
                desc: t('home.step.routing.desc'),
                icon: IconMapPin,
              },
              {
                n: '03',
                title: t('home.step.resolution.title'),
                desc: t('home.step.resolution.desc'),
                icon: IconCheck,
              },
            ].map((step) => (
              <div key={step.n} className="flex items-center gap-4 px-5 py-4">
                <span className="font-mono text-[11px] text-[var(--color-text-tertiary)]">
                  {step.n}
                </span>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                  <step.icon className="h-4 w-4" stroke={1.6} />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-subtle)]">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {me.isLoading ? null : me.data ? (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border-faint)] pt-5 text-xs text-[var(--color-text-subtle)]">
          <span>{t('home.signedInAs', { name: me.data.name ?? t('common.citizen') })}</span>
          <span className="font-mono">{me.data.mobile ?? ''}</span>
        </footer>
      ) : null}
    </div>
  );
}
