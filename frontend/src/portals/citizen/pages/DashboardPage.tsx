import { Link } from 'react-router-dom';
import { type JSX } from 'react';
import { IconAlertCircle, IconRefresh, IconWifiOff } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../auth/AuthContext';
import { apiRequest, type ApiEnvelope } from '../../../auth/api';
import { type ApiReportPayload } from '../api/client';
import { Spinner, EmptyState, ErrorState } from '../../../shared/ui';
import { ApiError } from '../../../shared/api/errors';
import { StatusBadge } from '../components/StatusBadge';
import { getQueue } from '../offline/queue';
import { normalizeReport } from '../api/client';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useMessages } from '../messages';

interface ReportSummary {
  id: string;
  title: string;
  status: { code: string; name: string };
  type?: { code: string; name: string };
  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * T-M13-014 — Citizen dashboard.
 *
 * What it shows:
 *  - a one-line welcome,
 *  - a CTA to submit a new report,
 *  - the citizen's 3 most-recent reports,
 *  - a count of items in the offline queue (when > 0).
 *
 * The dashboard is intentionally quiet so it renders fast
 * on the citizen's phone.
 */
export default function DashboardPage(): JSX.Element {
  const { user } = useAuth();
  const { t, locale } = useMessages();
  const online = useOnlineStatus();
  const reports = useQuery({
    queryKey: ['citizen', 'reports', 'recent'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<ReportSummary[]>>('/citizen/reports', {
        query: { per_page: 3 },
      });
      return res.data.map((report) => normalizeReport(report as ApiReportPayload));
    },
  });
  const queue = useQuery({
    queryKey: ['citizen', user?.id, 'queue', 'size'],
    queryFn: async () => getQueue(user?.id).size(),
    refetchInterval: 5_000,
  });

  if (reports.isError && !reports.data) {
    const err = reports.error;
    const isAuthError = err instanceof ApiError && err.status === 401;

    if (!online) {
      return (
        <div className="min-w-0 space-y-6">
          <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border-faint)] pb-6">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
                {t('citizenServices')}
              </p>
              <h1 className="mt-2 text-[2rem] font-normal leading-[1.05] tracking-[-0.035em] text-[var(--color-ink)] sm:text-4xl">
                {user?.name ? t('home.greeting', { name: user.name }) : t('home.greetingFallback')}
              </h1>
            </div>
          </header>
          <div className="flex items-center justify-center py-16">
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
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-5 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-canvas)]"
              >
                <IconRefresh className="h-4 w-4" stroke={1.6} aria-hidden />
                {t('home.offline.action')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (isAuthError) {
      return (
        <div className="min-w-0 space-y-6">
          <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border-faint)] pb-6">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
                {t('citizenServices')}
              </p>
              <h1 className="mt-2 text-[2rem] font-normal leading-[1.05] tracking-[-0.035em] text-[var(--color-ink)] sm:text-4xl">
                {user?.name ? t('home.greeting', { name: user.name }) : t('home.greetingFallback')}
              </h1>
            </div>
          </header>
          <div className="flex items-center justify-center py-16">
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
              <Link
                to="/citizen/login"
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-5 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-canvas)]"
              >
                {t('home.session.action')}
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-w-0 space-y-6">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border-faint)] pb-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
              {t('citizenServices')}
            </p>
            <h1 className="mt-2 text-[2rem] font-normal leading-[1.05] tracking-[-0.035em] text-[var(--color-ink)] sm:text-4xl">
              {user?.name ? t('home.greeting', { name: user.name }) : t('home.greetingFallback')}
            </h1>
          </div>
        </header>
        <div className="flex items-center justify-center py-16">
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
                className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-5 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-canvas)]"
              >
                <IconRefresh className="h-4 w-4" stroke={1.6} aria-hidden />
                {t('home.error.action')}
              </button>
            }
          />
        </div>
      </div>
    );
  }

  if (reports.isLoading && !reports.data) {
    return (
      <div className="min-w-0 space-y-6">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border-faint)] pb-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
              {t('citizenServices')}
            </p>
            <h1 className="mt-2 text-[2rem] font-normal leading-[1.05] tracking-[-0.035em] text-[var(--color-ink)] sm:text-4xl">
              {user?.name ? t('home.greeting', { name: user.name }) : t('home.greetingFallback')}
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-6 text-[var(--color-text-secondary)]">
              {t('home.tagline')}
            </p>
          </div>
        </header>
        <div className="flex min-h-[40vh] items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4 text-center">
            <Spinner label={t('spinner.loadingYourDashboard')} />
            <p className="text-sm text-[var(--color-text-subtle)]">
              {t('spinner.loadingYourDashboard')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const list = reports.data ?? [];
  const queueSize = queue.data ?? 0;

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border-faint)] pb-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
            {t('citizenServices')}
          </p>
          <h1 className="mt-2 text-[2rem] font-normal leading-[1.05] tracking-[-0.035em] text-[var(--color-ink)] sm:text-4xl">
            {user?.name ? t('home.greeting', { name: user.name }) : t('home.greetingFallback')}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-6 text-[var(--color-text-secondary)]">
            {t('home.tagline')}
          </p>
        </div>
      </header>

      {reports.isError && reports.data && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <IconAlertCircle className="h-5 w-5 shrink-0" stroke={1.6} aria-hidden />
          <span className="flex-1">{t('home.stale.message')}</span>
          <button
            type="button"
            onClick={() => {
              void reports.refetch();
            }}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 font-medium underline-offset-2 hover:underline"
          >
            <IconRefresh className="h-4 w-4" stroke={1.6} aria-hidden />
            {t('home.stale.retry')}
          </button>
        </div>
      )}

      {queueSize > 0 ? (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <IconWifiOff className="h-5 w-5 shrink-0" stroke={1.6} aria-hidden />
          <span className="flex-1">
            {t('home.offlineSync', { count: queueSize, plural: queueSize === 1 ? '' : 's' })}.{' '}
            {t('home.offlineSyncDetail')}
          </span>
        </div>
      ) : null}

      <Link
        to="/citizen/submit"
        className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-5 py-4 text-center text-sm font-medium text-white shadow-sm transition hover:bg-black"
      >
        <span aria-hidden>+</span> {t('home.fileNewReport')}
      </Link>

      <section
        aria-labelledby="recent-reports"
        className="rounded-xl bg-white shadow-sm ring-1 ring-black/5"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-5 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              {t('home.recentActivity')}
            </p>
            <h2
              id="recent-reports"
              className="mt-1 text-lg font-medium tracking-[-0.015em] text-[var(--color-ink)]"
            >
              {t('home.yourLatestReports')}
            </h2>
          </div>
        </div>
        {reports.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner label={t('home.loadingReports')} />
          </div>
        ) : list.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={t('home.dashboardEmptyTitle')}
              description={t('home.empty.description')}
              action={
                <Link
                  to="/citizen/submit"
                  className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-ink)] px-5 text-sm font-medium text-white transition hover:bg-black"
                >
                  {t('home.empty.action')}
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border-subtle)]">
            {list.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <Link
                    to={`/citizen/reports/${r.id}`}
                    className="block truncate text-sm font-medium text-[var(--color-ink)] hover:underline"
                  >
                    {r.title}
                  </Link>
                  <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                    {r.created_at ? new Date(r.created_at).toLocaleString(locale) : '—'}
                  </div>
                </div>
                <StatusBadge status={r.status} className="shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
