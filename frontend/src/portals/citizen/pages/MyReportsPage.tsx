import { Link, useSearchParams } from 'react-router-dom';
import { type JSX, useMemo } from 'react';
import {
  IconCheck,
  IconChevronRight,
  IconClock,
  IconExclamationCircle,
  IconFileDescription,
  IconFilter,
  IconMapPin,
  IconPlus,
} from '@tabler/icons-react';
import { Spinner } from '../../moderator/design';
import { useCitizenReports } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';

type StatusFilter = 'all' | 'open' | 'closed';
type SortField = 'date' | 'status' | 'reference';
type SortDir = 'asc' | 'desc';

interface ReportRow {
  id: string;
  reference: string;
  title: string;
  description?: string | null;
  status: { code: string; name?: string };
  type?: { name?: string } | null;
  created_at: string;
  location?: { latitude: number; longitude: number; address?: string | null } | null;
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function buildTrackingId(uuid: string): string {
  const hex = uuid.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `CIP-${hex}`;
}

function isOpenStatus(code: string): boolean {
  return [
    'submitted',
    'pending_moderator',
    'pending_review',
    'ai_processing',
    'approved',
    'assigned',
    'in_progress',
    'escalated',
  ].includes(code);
}

const FILTER_TABS: { key: StatusFilter; label: string; icon?: JSX.Element }[] = [
  { key: 'all', label: 'All', icon: <IconFilter className="h-3.5 w-3.5" stroke={1.6} /> },
  { key: 'open', label: 'Pending', icon: <IconClock className="h-3.5 w-3.5" stroke={1.6} /> },
  { key: 'closed', label: 'Resolved', icon: <IconCheck className="h-3.5 w-3.5" stroke={1.6} /> },
];

function ReportCard({ report }: { report: ReportRow }): JSX.Element {
  return (
    <Link
      to={`/citizen/reports/${report.id}`}
      className="group flex min-h-16 items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:bg-[#faf9f6]"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#efeee9]">
        {['resolved', 'verified', 'closed'].includes(report.status.code) ? (
          <IconCheck className="h-5 w-5 text-[#1d1d1b]" stroke={1.8} />
        ) : (
          <IconClock className="h-5 w-5 text-[#1d1d1b]" stroke={1.7} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
            {report.reference}
          </p>
          <StatusBadge status={report.status} />
        </div>
        <p className="mt-1 truncate text-sm font-medium text-[#1d1d1b]">{report.title}</p>
        <div className="mt-1 flex items-center gap-3 text-xs text-[#6f6e69]">
          <span className="inline-flex items-center gap-1">
            <IconClock className="h-3 w-3" stroke={1.6} />
            {formatDate(report.created_at)}
          </span>
          {report.location?.address && (
            <span className="inline-flex items-center gap-1 truncate">
              <IconMapPin className="h-3 w-3 shrink-0" stroke={1.6} />
              <span className="truncate">{report.location.address}</span>
            </span>
          )}
        </div>
      </div>
      <IconChevronRight
        className="h-4 w-4 shrink-0 text-[#aaa9a4] transition-transform group-hover:translate-x-0.5"
        stroke={1.5}
      />
    </Link>
  );
}

export default function MyReportsPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const statusFilter = (searchParams.get('status') as StatusFilter) ?? 'all';
  const sortField = (searchParams.get('sort') as SortField) ?? 'date';
  const sortDir = (searchParams.get('dir') as SortDir) ?? 'desc';

  const reports = useCitizenReports(page, 12);
  const meta = reports.data?.meta ?? { page: 1, per_page: 12, total: 0, last_page: 1 };

  const filteredReports = useMemo<ReportRow[]>(() => {
    const rows: ReportRow[] = (reports.data?.data ?? [])
      .filter((r) => r.created_at != null)
      .map((r) => ({
        id: r.id,
        reference: buildTrackingId(r.id),
        title: r.title,
        description: r.description,
        status: r.status,
        type: r.type,
        created_at: r.created_at as string,
        location: r.location ?? null,
      }));

    let filtered = rows;
    if (statusFilter === 'open') filtered = rows.filter((r) => isOpenStatus(r.status.code));
    if (statusFilter === 'closed') filtered = rows.filter((r) => !isOpenStatus(r.status.code));

    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = a.created_at.localeCompare(b.created_at);
      else if (sortField === 'status') cmp = a.status.code.localeCompare(b.status.code);
      else if (sortField === 'reference') cmp = a.reference.localeCompare(b.reference);
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

  function applyFilter(next: StatusFilter): void {
    updateParams({ status: next === 'all' ? null : next, page: null });
  }

  const totalPages = Math.max(meta.last_page, 1);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-[#d9d7d0] bg-white px-4 pb-5 pt-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#85847f]">
                My Reports
              </p>
              <h1 className="mt-2 text-2xl font-normal tracking-[-0.025em] text-[#1d1d1b]">
                Service Requests
              </h1>
            </div>
            <Link
              to="/citizen/submit"
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-black/15 bg-white px-5 text-sm font-medium text-[#1d1d1b] transition hover:border-black/30"
              aria-label="New Report"
            >
              <IconPlus className="h-4 w-4" stroke={1.7} />
              <span className="hidden sm:inline">New Report</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-5">
        {/* Filter Pills */}
        <div className="mb-5">
          <div
            role="tablist"
            aria-label="Filter reports by status"
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
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-[#6f6e69] hover:bg-slate-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {reports.isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Spinner label="Loading your reports" />
          </div>
        ) : reports.isError || !reports.data ? (
          <div className="rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#efeee9]">
              <IconExclamationCircle className="h-6 w-6 text-[#1d1d1b]" stroke={1.6} />
            </div>
            <p className="text-sm font-medium text-[#1d1d1b]">Unable to load reports</p>
            <p className="mt-1 text-sm text-[#6f6e69]">
              Please check your connection and try again.
            </p>
          </div>
        ) : reports.data.data.length === 0 ? (
          /* Empty State */
          <div className="rounded-xl bg-white px-6 py-16 text-center shadow-sm ring-1 ring-slate-200">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#efeee9]">
              <IconFileDescription className="h-7 w-7 text-[#1d1d1b]" stroke={1.6} />
            </div>
            <h2 className="text-base font-medium text-[#1d1d1b]">No reports yet</h2>
            <p className="mx-auto mt-1 max-w-xs text-sm text-[#6f6e69]">
              File your first service request and track its progress.
            </p>
            <Link
              to="/citizen/submit"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border border-black/15 bg-[#1d1d1b] px-6 text-sm font-medium text-white transition hover:bg-black"
            >
              <IconPlus className="h-4 w-4" stroke={1.7} />
              File Your First Report
            </Link>
          </div>
        ) : (
          <>
            {/* Results Count */}
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
              {meta.total} report{meta.total === 1 ? '' : 's'}
              {statusFilter !== 'all' && ` (${statusFilter === 'open' ? 'pending' : 'resolved'})`}
            </p>

            {/* Report Cards */}
            <div className="space-y-4">
              {filteredReports.map((report) => (
                <ReportCard key={report.id} report={report} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => goToPage(meta.page - 1)}
                  disabled={meta.page <= 1}
                  className="inline-flex h-11 items-center gap-1 rounded-full bg-white px-4 text-sm font-medium text-[#1d1d1b] ring-1 ring-slate-200 transition hover:bg-[#faf9f6] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <IconChevronRight className="h-4 w-4 rotate-180" stroke={1.6} />
                  <span className="hidden sm:inline">Previous</span>
                </button>

                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                  Page {meta.page} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => goToPage(meta.page + 1)}
                  disabled={meta.page >= totalPages}
                  className="inline-flex h-11 items-center gap-1 rounded-full bg-white px-4 text-sm font-medium text-[#1d1d1b] ring-1 ring-slate-200 transition hover:bg-[#faf9f6] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <IconChevronRight className="h-4 w-4" stroke={1.6} />
                </button>
              </nav>
            )}

            {/* Help Footer */}
            <div className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="text-xs text-[#6f6e69]">
                Tap a report to view its full timeline and any assigned actions. Use the Reference
                ID when contacting support.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
