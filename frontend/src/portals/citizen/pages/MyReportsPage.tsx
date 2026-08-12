import { Link, useSearchParams } from 'react-router-dom';
import { type FormEvent, type JSX, useMemo, useState } from 'react';
import {
  IconAlertCircle,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconExclamationCircle,
  IconFileDescription,
  IconFilter,
  IconMapPin,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconWifiOff,
} from '@tabler/icons-react';
import { Spinner } from '../../../shared/ui';
import { ApiError } from '../../../shared/api/errors';
import { useCitizenReports, lifecycleGroup, useReportTypes } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useMessages } from '../messages';
import type { StatusFilter } from '../types';

type SortField = 'date' | 'status' | 'reference';
type SortDir = 'asc' | 'desc';

interface ReportRow {
  id: string;
  tracking_number: string;
  title: string;
  description?: string | null;
  status: { code: string; name?: string };
  type?: { name?: string } | null;
  created_at: string;
  location?: { latitude: number; longitude: number; address?: string | null } | null;
}

function formatDate(value: string, locale: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

const FILTER_TABS: { key: StatusFilter; label: string; icon?: JSX.Element }[] = [
  {
    key: 'all',
    label: 'reports.filter.all',
    icon: <IconFilter className="h-3.5 w-3.5" stroke={1.6} />,
  },
  {
    key: 'open',
    label: 'reports.filter.pending',
    icon: <IconClock className="h-3.5 w-3.5" stroke={1.6} />,
  },
  {
    key: 'awaiting_citizen',
    label: 'reports.filter.awaitingYou',
    icon: <IconClock className="h-3.5 w-3.5" stroke={1.6} />,
  },
  {
    key: 'closed',
    label: 'reports.filter.closed',
    icon: <IconCheck className="h-3.5 w-3.5" stroke={1.6} />,
  },
  {
    key: 'rejected',
    label: 'reports.filter.rejected',
    icon: <IconExclamationCircle className="h-3.5 w-3.5" stroke={1.6} />,
  },
  {
    key: 'merged',
    label: 'reports.filter.merged',
    icon: <IconCheck className="h-3.5 w-3.5" stroke={1.6} />,
  },
];

function PageHeader({ t }: { t: (key: string) => string }): JSX.Element {
  return (
    <header className="flex items-start justify-between gap-5 border-b border-[var(--color-border-faint)] px-4 pb-5 pt-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
          {t('nav.reports')}
        </p>
        <h1 className="mt-2 text-2xl font-normal tracking-[-0.025em] text-[var(--color-ink)]">
          {t('reports.title')}
        </h1>
      </div>
      <Link
        to="/citizen/submit"
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-[var(--color-ink)] px-5 text-sm font-medium text-white transition hover:bg-black"
        aria-label={t('reports.newReport')}
      >
        <IconPlus className="h-4 w-4" stroke={1.7} />
        <span className="hidden sm:inline">{t('reports.newReport')}</span>
      </Link>
    </header>
  );
}

function EmptyStateSection({
  t,
  statusFilter,
  applyFilter,
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
  statusFilter: StatusFilter;
  applyFilter: (next: StatusFilter) => void;
}): JSX.Element {
  return (
    <div className="py-16 text-center" role="status">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-surface-alt)]">
        <IconFileDescription className="h-7 w-7 text-[var(--color-ink)]" stroke={1.6} />
      </div>
      <h2 className="text-base font-medium text-[var(--color-ink)]">
        {statusFilter === 'all'
          ? t('reports.noReportsYet')
          : t('reports.noFilteredReports', { status: statusFilter })}
      </h2>
      <p className="mx-auto mt-1 max-w-xs text-sm text-[var(--color-text-secondary)]">
        {statusFilter === 'all' ? t('reports.fileFirst') : t('reports.tryAnotherFilter')}
      </p>
      {statusFilter === 'all' ? (
        <Link
          to="/citizen/submit"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--color-ink)] px-6 text-sm font-medium text-white transition hover:bg-black"
        >
          <IconPlus className="h-4 w-4" stroke={1.7} />
          {t('reports.fileYourFirst')}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => applyFilter('all')}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--color-ink)] px-6 text-sm font-medium text-white transition hover:bg-black"
        >
          {t('reports.showAll')}
        </button>
      )}
    </div>
  );
}

function ReportRow({ report, locale }: { report: ReportRow; locale: string }): JSX.Element {
  const group = lifecycleGroup(report.status.code);
  return (
    <Link
      to={`/citizen/reports/${report.id}`}
      className="group block rounded-xl bg-white p-4 transition hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-surface-alt)]">
          {group === 'closed' || group === 'merged' ? (
            <IconCheck className="h-5 w-5" stroke={1.8} />
          ) : (
            <IconClock className="h-5 w-5" stroke={1.7} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-medium text-[var(--color-ink)]">{report.title}</p>
            <StatusBadge status={report.status} />
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-[var(--color-text-secondary)]">
            {report.description}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em]">
              {report.tracking_number}
            </span>
            <span className="text-[var(--color-border-subtle)]">·</span>
            <span>{formatDate(report.created_at, locale)}</span>
            {report.location?.address && (
              <>
                <span className="text-[var(--color-border-subtle)]">·</span>
                <span className="inline-flex items-center gap-1 truncate">
                  <IconMapPin className="h-3 w-3 shrink-0" stroke={1.6} />
                  <span className="truncate max-w-32">{report.location.address}</span>
                </span>
              </>
            )}
          </div>
        </div>
        <IconChevronRight
          className="h-5 w-5 shrink-0 text-[var(--color-text-tertiary)] transition-transform group-hover:translate-x-0.5"
          stroke={1.5}
        />
      </div>
    </Link>
  );
}

export default function MyReportsPage(): JSX.Element {
  const { t, locale } = useMessages();
  const online = useOnlineStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const statusFilter = (searchParams.get('status') as StatusFilter) ?? 'all';
  const sortField = (searchParams.get('sort') as SortField) ?? 'date';
  const sortDir = (searchParams.get('dir') as SortDir) ?? 'desc';
  const search = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const area = searchParams.get('area') ?? '';
  const dateFrom = searchParams.get('date_from') ?? '';
  const dateTo = searchParams.get('date_to') ?? '';
  const cursor = searchParams.get('cursor') ?? '';
  const [searchInput, setSearchInput] = useState(search);
  const [categoryInput, setCategoryInput] = useState(category);
  const [areaInput, setAreaInput] = useState(area);
  const [dateFromInput, setDateFromInput] = useState(dateFrom);
  const [dateToInput, setDateToInput] = useState(dateTo);
  const reportTypes = useReportTypes();

  const reports = useCitizenReports(page, 12, search, {
    status: statusFilter === 'all' ? undefined : statusFilter,
    category: category || undefined,
    area: area || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    cursor: cursor || undefined,
    cursor_mode: true,
  });
  const meta = reports.data?.meta ?? { page: 1, per_page: 12, total: 0, last_page: 1 };

  const filteredReports = useMemo<ReportRow[]>(() => {
    const rows: ReportRow[] = (reports.data?.data ?? [])
      .filter((r) => r.created_at != null)
      .map((r) => ({
        id: r.id,
        tracking_number: r.tracking_number,
        title: r.title,
        description: r.description,
        status: r.status,
        type: r.type,
        created_at: r.created_at as string,
        location: r.location ?? null,
      }));

    let filtered = rows;
    if (statusFilter !== 'all') {
      filtered = rows.filter((r) => lifecycleGroup(r.status.code) === statusFilter);
    }

    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = a.created_at.localeCompare(b.created_at);
      else if (sortField === 'status') cmp = a.status.code.localeCompare(b.status.code);
      else if (sortField === 'reference') cmp = a.tracking_number.localeCompare(b.tracking_number);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [reports.data?.data, statusFilter, sortField, sortDir]);

  function updateParams(updates: Record<string, string | null>): void {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    setSearchParams(params);
  }

  function goToPage(nextPage: number): void {
    updateParams({ page: nextPage <= 1 ? null : String(nextPage) });
  }

  function goToCursor(nextCursor: string | null | undefined): void {
    updateParams({ cursor: nextCursor || null, page: null });
  }

  function applyFilter(next: StatusFilter): void {
    updateParams({ status: next === 'all' ? null : next, page: null });
  }

  function applyAdvancedFilters(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    updateParams({
      category: categoryInput || null,
      area: areaInput.trim() || null,
      date_from: dateFromInput || null,
      date_to: dateToInput || null,
      page: null,
    });
  }

  const totalPages = Math.max(meta.last_page, 1);

  if (reports.isError && !reports.data) {
    const err = reports.error;
    const isAuthError = err instanceof ApiError && err.status === 401;

    if (isAuthError) {
      return (
        <div className="min-h-screen bg-[var(--color-canvas)]">
          <PageHeader t={t} />
          <main className="mx-auto max-w-3xl px-4 pb-24 pt-5">
            <div className="py-16 text-center" role="alert" aria-live="assertive">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                <IconAlertCircle className="h-6 w-6 text-[var(--color-ink)]" stroke={1.6} />
              </div>
              <p className="text-sm font-medium text-[var(--color-ink)]">
                {t('banner.sessionExpired')}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {t('banner.sessionExpiredDetail')}
              </p>
              <Link
                to="/citizen/login"
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--color-ink)] px-6 text-sm font-medium text-white transition hover:bg-black"
              >
                {t('banner.signInAgain')}
              </Link>
            </div>
          </main>
        </div>
      );
    }

    if (!online) {
      return (
        <div className="min-h-screen bg-[var(--color-canvas)]">
          <PageHeader t={t} />
          <main className="mx-auto max-w-3xl px-4 pb-24 pt-5">
            <div className="py-16 text-center" role="alert" aria-live="assertive">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                <IconWifiOff className="h-6 w-6 text-[var(--color-ink)]" stroke={1.6} />
              </div>
              <p className="text-sm font-medium text-[var(--color-ink)]">{t('banner.offline')}</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {t('banner.offlineDetail')}
              </p>
              <button
                type="button"
                onClick={() => {
                  void reports.refetch();
                }}
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--color-ink)] px-6 text-sm font-medium text-white transition hover:bg-black"
              >
                <IconRefresh className="h-4 w-4" stroke={1.6} />
                {t('common.retry')}
              </button>
            </div>
          </main>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[var(--color-canvas)]">
        <PageHeader t={t} />
        <main className="mx-auto max-w-3xl px-4 pb-24 pt-5">
          <div className="py-16 text-center" role="alert" aria-live="assertive">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--color-surface-alt)]">
              <IconExclamationCircle className="h-6 w-6 text-[var(--color-ink)]" stroke={1.6} />
            </div>
            <p className="text-sm font-medium text-[var(--color-ink)]">
              {t('reports.unableToLoad')}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {t('reports.checkConnection')}
            </p>
            <button
              type="button"
              onClick={() => {
                void reports.refetch();
              }}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--color-ink)] px-6 text-sm font-medium text-white transition hover:bg-black"
            >
              <IconRefresh className="h-4 w-4" stroke={1.6} />
              {t('common.retry')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-canvas)]">
      <PageHeader t={t} />

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-5">
        <div className="mb-5">
          <form
            className="mb-4 flex gap-2"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              updateParams({ q: searchInput.trim() || null, page: null });
            }}
          >
            <label className="sr-only" htmlFor="report-search">
              {t('reports.searchLabel')}
            </label>
            <div className="relative flex-1">
              <IconSearch
                className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-[var(--color-text-tertiary)]"
                stroke={1.6}
                aria-hidden
              />
              <input
                id="report-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t('reports.searchPlaceholder')}
                className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-white pl-10 pr-4 text-sm outline-none focus:border-[var(--color-ink)]"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-full bg-[var(--color-ink)] px-5 text-sm font-medium text-white"
            >
              {t('reports.search')}
            </button>
          </form>
          <div
            role="tablist"
            aria-label={t('reports.filterStatusLabel')}
            className="flex gap-2 overflow-x-auto pb-1"
          >
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={statusFilter === tab.key}
                onClick={() => applyFilter(tab.key)}
                className={`flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition ${
                  statusFilter === tab.key
                    ? 'bg-[var(--color-ink)] text-white'
                    : 'bg-slate-100 text-[var(--color-text-secondary)] hover:bg-slate-200'
                }`}
              >
                {tab.icon}
                {t(tab.label)}
              </button>
            ))}
          </div>
          <form
            className="mt-3 grid gap-2 rounded-2xl border border-[var(--color-border-subtle)] bg-white p-3 sm:grid-cols-2 lg:grid-cols-5"
            onSubmit={applyAdvancedFilters}
            aria-label={t('reports.advancedFilters')}
          >
            <label className="text-xs text-[var(--color-text-secondary)]">
              <span className="sr-only">{t('reports.category')}</span>
              <select
                value={categoryInput}
                onChange={(event) => setCategoryInput(event.target.value)}
                className="h-11 w-full rounded-xl border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-ink)]"
              >
                <option value="">{t('reports.allCategories')}</option>
                {(reportTypes.data ?? []).map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-[var(--color-text-secondary)]">
              <span className="sr-only">{t('reports.area')}</span>
              <input
                value={areaInput}
                onChange={(event) => setAreaInput(event.target.value)}
                placeholder={t('reports.area')}
                className="h-11 w-full rounded-xl border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-ink)]"
              />
            </label>
            <label className="text-xs text-[var(--color-text-secondary)]">
              <span className="sr-only">{t('reports.dateFrom')}</span>
              <input
                type="date"
                value={dateFromInput}
                onChange={(event) => setDateFromInput(event.target.value)}
                aria-label={t('reports.dateFrom')}
                className="h-11 w-full rounded-xl border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-ink)]"
              />
            </label>
            <label className="text-xs text-[var(--color-text-secondary)]">
              <span className="sr-only">{t('reports.dateTo')}</span>
              <input
                type="date"
                value={dateToInput}
                onChange={(event) => setDateToInput(event.target.value)}
                aria-label={t('reports.dateTo')}
                className="h-11 w-full rounded-xl border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-ink)]"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                className="h-11 flex-1 rounded-xl bg-[var(--color-ink)] px-3 text-sm font-medium text-white"
              >
                {t('reports.applyFilters')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategoryInput('');
                  setAreaInput('');
                  setDateFromInput('');
                  setDateToInput('');
                  updateParams({
                    category: null,
                    area: null,
                    date_from: null,
                    date_to: null,
                    page: null,
                  });
                }}
                className="h-11 rounded-xl border border-[var(--color-border-subtle)] px-3 text-sm font-medium text-[var(--color-ink)]"
              >
                {t('reports.clearFilters')}
              </button>
            </div>
          </form>
        </div>

        {reports.isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Spinner label={t('reports.loading')} />
          </div>
        ) : reports.isError && reports.data ? (
          <>
            <div
              className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              role="status"
              aria-live="polite"
            >
              <IconAlertCircle className="h-5 w-5 shrink-0" stroke={1.6} aria-hidden />
              <span className="flex-1">{t('banner.stale')}</span>
              <button
                type="button"
                onClick={() => {
                  void reports.refetch();
                }}
                className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
              >
                <IconRefresh className="h-4 w-4" stroke={1.6} aria-hidden />
                {t('common.retry')}
              </button>
            </div>
            {filteredReports.length === 0 ? (
              <EmptyStateSection t={t} statusFilter={statusFilter} applyFilter={applyFilter} />
            ) : (
              <>
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                  {t('reports.reportCount', {
                    count: meta.total,
                    plural: meta.total === 1 ? '' : 's',
                  })}
                  {statusFilter !== 'all' && ` (${statusFilter})`}
                </p>
                <div className="divide-y divide-[var(--color-border-subtle)]">
                  {filteredReports.map((report) => (
                    <ReportRow key={report.id} report={report} locale={locale} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : filteredReports.length === 0 ? (
          <EmptyStateSection t={t} statusFilter={statusFilter} applyFilter={applyFilter} />
        ) : (
          <>
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              {t('reports.reportCount', {
                count: meta.total,
                plural: meta.total === 1 ? '' : 's',
              })}
              {statusFilter !== 'all' && ` (${statusFilter})`}
            </p>

            <div className="divide-y divide-[var(--color-border-subtle)]">
              {filteredReports.map((report) => (
                <ReportRow key={report.id} report={report} locale={locale} />
              ))}
            </div>

            {meta.next_cursor || meta.prev_cursor ? (
              <nav
                aria-label="Cursor pagination"
                className="mt-6 flex items-center justify-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => goToCursor(meta.prev_cursor)}
                  disabled={!meta.prev_cursor}
                  className="inline-flex h-11 items-center gap-1 rounded-full bg-white px-4 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-alt)] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={t('reports.pagination.previous')}
                >
                  <IconChevronRight className="h-4 w-4 rotate-180" stroke={1.6} />
                  <span className="hidden sm:inline">{t('reports.pagination.previous')}</span>
                </button>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                  {t('reports.pagination.cursorMode')}
                </span>
                <button
                  type="button"
                  onClick={() => goToCursor(meta.next_cursor)}
                  disabled={!meta.next_cursor}
                  className="inline-flex h-11 items-center gap-1 rounded-full bg-white px-4 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-alt)] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={t('reports.pagination.next')}
                >
                  <span className="hidden sm:inline">{t('reports.pagination.next')}</span>
                  <IconChevronRight className="h-4 w-4" stroke={1.6} />
                </button>
              </nav>
            ) : (
              totalPages > 1 && (
                <nav
                  aria-label="Pagination"
                  className="mt-6 flex items-center justify-center gap-2"
                >
                  <button
                    type="button"
                    onClick={() => goToPage(meta.page - 1)}
                    disabled={meta.page <= 1}
                    className="inline-flex h-11 items-center gap-1 rounded-full bg-white px-4 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-alt)] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={t('reports.pagination.previous')}
                  >
                    <IconChevronRight className="h-4 w-4 rotate-180" stroke={1.6} />
                    <span className="hidden sm:inline">{t('reports.pagination.previous')}</span>
                  </button>

                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    {t('reports.pagination.pageCount', { current: meta.page, total: totalPages })}
                  </span>

                  <button
                    type="button"
                    onClick={() => goToPage(meta.page + 1)}
                    disabled={meta.page >= totalPages}
                    className="inline-flex h-11 items-center gap-1 rounded-full bg-white px-4 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-alt)] disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={t('reports.pagination.next')}
                  >
                    <span className="hidden sm:inline">{t('reports.pagination.next')}</span>
                    <IconChevronRight className="h-4 w-4" stroke={1.6} />
                  </button>
                </nav>
              )
            )}

            <p className="mt-6 text-xs text-[var(--color-text-secondary)]">
              {t('reports.tapHint')}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
