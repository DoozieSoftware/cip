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
import { useCitizenReports, lifecycleGroup } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';

type StatusFilter = 'all' | 'open' | 'awaiting_citizen' | 'closed' | 'rejected' | 'merged';
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

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const FILTER_TABS: { key: StatusFilter; label: string; icon?: JSX.Element }[] = [
  { key: 'all', label: 'All', icon: <IconFilter className="h-3.5 w-3.5" stroke={1.6} /> },
  { key: 'open', label: 'Pending', icon: <IconClock className="h-3.5 w-3.5" stroke={1.6} /> },
  {
    key: 'awaiting_citizen',
    label: 'Awaiting You',
    icon: <IconClock className="h-3.5 w-3.5" stroke={1.6} />,
  },
  { key: 'closed', label: 'Closed', icon: <IconCheck className="h-3.5 w-3.5" stroke={1.6} /> },
  {
    key: 'rejected',
    label: 'Rejected',
    icon: <IconExclamationCircle className="h-3.5 w-3.5" stroke={1.6} />,
  },
  { key: 'merged', label: 'Merged', icon: <IconCheck className="h-3.5 w-3.5" stroke={1.6} /> },
];

function ReportRow({ report }: { report: ReportRow }): JSX.Element {
  const group = lifecycleGroup(report.status.code);
  return (
    <Link
      to={`/citizen/reports/${report.id}`}
      className="group block rounded-xl bg-white p-4 transition hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#efeee9]">
          {group === 'closed' || group === 'merged' ? (
            <IconCheck className="h-5 w-5" stroke={1.8} />
          ) : (
            <IconClock className="h-5 w-5" stroke={1.7} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-medium text-[#1d1d1b]">{report.title}</p>
            <StatusBadge status={report.status} />
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-[#6f6e69]">{report.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#85847f]">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em]">
              {report.tracking_number}
            </span>
            <span className="text-[#d0cec8]">·</span>
            <span>{formatDate(report.created_at)}</span>
            {report.location?.address && (
              <>
                <span className="text-[#d0cec8]">·</span>
                <span className="inline-flex items-center gap-1 truncate">
                  <IconMapPin className="h-3 w-3 shrink-0" stroke={1.6} />
                  <span className="truncate max-w-32">{report.location.address}</span>
                </span>
              </>
            )}
          </div>
        </div>
        <IconChevronRight
          className="h-5 w-5 shrink-0 text-[#aaa9a4] transition-transform group-hover:translate-x-0.5"
          stroke={1.5}
        />
      </div>
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

  function applyFilter(next: StatusFilter): void {
    updateParams({ status: next === 'all' ? null : next, page: null });
  }

  const totalPages = Math.max(meta.last_page, 1);

  return (
    <div className="min-h-screen bg-[#f3f2ed]">
      <header className="flex items-start justify-between gap-5 border-b border-[#d9d7d0] px-4 pb-5 pt-6">
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
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#1d1d1b] px-5 text-sm font-medium text-white transition hover:bg-black"
          aria-label="New Report"
        >
          <IconPlus className="h-4 w-4" stroke={1.7} />
          <span className="hidden sm:inline">New Report</span>
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-5">
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
                    ? 'bg-[#1d1d1b] text-white'
                    : 'bg-slate-100 text-[#6f6e69] hover:bg-slate-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {reports.isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Spinner label="Loading your reports" />
          </div>
        ) : reports.isError || !reports.data ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#efeee9]">
              <IconExclamationCircle className="h-6 w-6 text-[#1d1d1b]" stroke={1.6} />
            </div>
            <p className="text-sm font-medium text-[#1d1d1b]">Unable to load reports</p>
            <p className="mt-1 text-sm text-[#6f6e69]">
              Please check your connection and try again.
            </p>
          </div>
        ) : reports.data.data.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#efeee9]">
              <IconFileDescription className="h-7 w-7 text-[#1d1d1b]" stroke={1.6} />
            </div>
            <h2 className="text-base font-medium text-[#1d1d1b]">No reports yet</h2>
            <p className="mx-auto mt-1 max-w-xs text-sm text-[#6f6e69]">
              File your first service request and track its progress.
            </p>
            <Link
              to="/citizen/submit"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[#1d1d1b] px-6 text-sm font-medium text-white transition hover:bg-black"
            >
              <IconPlus className="h-4 w-4" stroke={1.7} />
              File Your First Report
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
              {meta.total} report{meta.total === 1 ? '' : 's'}
              {statusFilter !== 'all' && ` (${statusFilter})`}
            </p>

            <div className="divide-y divide-[#e4e2dc]">
              {filteredReports.map((report) => (
                <ReportRow key={report.id} report={report} />
              ))}
            </div>

            {totalPages > 1 && (
              <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => goToPage(meta.page - 1)}
                  disabled={meta.page <= 1}
                  className="inline-flex h-11 items-center gap-1 rounded-full bg-white px-4 text-sm font-medium text-[#1d1d1b] transition hover:bg-[#efeee9] disabled:cursor-not-allowed disabled:opacity-40"
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
                  className="inline-flex h-11 items-center gap-1 rounded-full bg-white px-4 text-sm font-medium text-[#1d1d1b] transition hover:bg-[#efeee9] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <IconChevronRight className="h-4 w-4" stroke={1.6} />
                </button>
              </nav>
            )}

            <p className="mt-6 text-xs text-[#6f6e69]">
              Tap a report to view its full timeline and any assigned actions. Use the Reference ID
              when contacting support.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
