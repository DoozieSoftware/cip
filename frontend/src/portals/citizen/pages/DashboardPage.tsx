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
        <div className="space-y-6">
          <header>
            <h1 className="text-2xl font-bold text-slate-900">
              {user?.name ? t('home.greeting', { name: user.name }) : t('home.greetingFallback')}
            </h1>
          </header>
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center px-6 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-slate-100">
                <IconWifiOff className="h-7 w-7 text-slate-500" stroke={1.5} aria-hidden />
              </span>
              <p className="mt-4 text-base font-medium text-slate-900">{t('home.offline.title')}</p>
              <p className="mt-1 text-sm text-slate-500">{t('home.offline.detail')}</p>
              <button
                type="button"
                onClick={() => {
                  void reports.refetch();
                }}
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
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
        <div className="space-y-6">
          <header>
            <h1 className="text-2xl font-bold text-slate-900">
              {user?.name ? t('home.greeting', { name: user.name }) : t('home.greetingFallback')}
            </h1>
          </header>
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center px-6 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-slate-100">
                <IconAlertCircle className="h-7 w-7 text-slate-500" stroke={1.5} aria-hidden />
              </span>
              <p className="mt-4 text-base font-medium text-slate-900">{t('home.session.title')}</p>
              <p className="mt-1 text-sm text-slate-500">{t('home.session.detail')}</p>
              <Link
                to="/citizen/login"
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {t('home.session.action')}
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">
            {user?.name ? t('home.greeting', { name: user.name }) : t('home.greetingFallback')}
          </h1>
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
                className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
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
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">
            {user?.name ? t('home.greeting', { name: user.name }) : t('home.greetingFallback')}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{t('home.tagline')}</p>
        </header>
        <div className="flex min-h-[40vh] items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4 text-center">
            <Spinner label={t('spinner.loadingYourDashboard')} />
            <p className="text-sm text-slate-500">{t('spinner.loadingYourDashboard')}…</p>
          </div>
        </div>
      </div>
    );
  }

  const list = reports.data ?? [];
  const queueSize = queue.data ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          {user?.name ? t('home.greeting', { name: user.name }) : t('home.greetingFallback')}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{t('home.tagline')}</p>
      </header>

      {reports.isError && reports.data && (
        <div
          role="alert"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          <div className="flex items-center gap-2">
            <IconAlertCircle className="h-4 w-4 shrink-0" stroke={1.6} aria-hidden />
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
        </div>
      )}

      {queueSize > 0 ? (
        <div
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          {t('home.offlineSync', { count: queueSize, plural: queueSize === 1 ? '' : 's' })}.{' '}
          {t('home.offlineSyncDetail')}
        </div>
      ) : null}

      <Link
        to="/citizen/submit"
        className="block rounded-lg bg-blue-600 px-5 py-4 text-center text-base font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        + {t('home.fileNewReport')}
      </Link>

      <section aria-labelledby="recent-reports">
        <h2 id="recent-reports" className="text-sm font-semibold text-slate-700">
          {t('home.recentActivity')}
        </h2>
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {reports.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner label={t('home.loadingReports')} />
            </div>
          ) : list.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={t('home.dashboardEmptyTitle')}
                description={t('home.empty.description')}
                action={
                  <Link
                    to="/citizen/submit"
                    className="mt-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    {t('home.empty.action')}
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {list.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <Link
                      to={`/citizen/reports/${r.id}`}
                      className="block truncate text-sm font-medium text-slate-900 hover:underline"
                    >
                      {r.title}
                    </Link>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {r.created_at ? new Date(r.created_at).toLocaleString(locale) : '—'}
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
