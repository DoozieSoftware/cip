import { Link, useSearchParams } from 'react-router-dom';
import { type JSX, useMemo, useState } from 'react';
import {
  FileText,
  ChevronRight,
  Plus,
  ArrowUp,
  ArrowDown,
  MapPin,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { EmptyState, Spinner, Table, THead, TBody, TR, TH, TD } from '../../moderator/design';
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

function buildPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('…');
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push('…');
  pages.push(total);
  return pages;
}

const FILTER_TABS: { key: StatusFilter; label: string; count?: number }[] = [
  { key: 'all', label: 'All Reports' },
  { key: 'open', label: 'In Progress' },
  { key: 'closed', label: 'Resolved' },
];

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }): JSX.Element {
  if (!active)
    return (
      <span className="h-4 w-4 opacity-0 group-hover:opacity-40 transition-opacity">
        <ArrowUp className="h-3.5 w-3.5" />
      </span>
    );
  return dir === 'asc' ? (
    <ArrowUp className="h-3.5 w-3.5" />
  ) : (
    <ArrowDown className="h-3.5 w-3.5" />
  );
}

function ReportCard({ report }: { report: ReportRow }): JSX.Element {
  return (
    <Link
      to={`/citizen/reports/${report.id}`}
      className="group block rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-slate-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs font-semibold tracking-wider text-slate-500">
            {report.reference}
          </p>
          <h3 className="mt-1.5 text-base font-semibold text-slate-900 leading-snug">
            {report.title}
          </h3>
          {report.type?.name && <p className="mt-1 text-sm text-slate-500">{report.type.name}</p>}
        </div>
        <StatusBadge status={report.status} />
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {formatDate(report.created_at)}
        </span>
        {report.location?.address && (
          <span className="inline-flex items-center gap-1.5 truncate max-w-[200px]">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{report.location.address}</span>
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-sm font-medium text-slate-900 group-hover:text-blue-700 transition-colors">
          View Details
        </span>
        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
      </div>
    </Link>
  );
}

export default function MyReportsPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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

  function goToPage(nextPage: number): void {
    const params = new URLSearchParams(searchParams);
    if (nextPage <= 1) params.delete('page');
    else params.set('page', String(nextPage));
    setSearchParams(params);
  }

  function toggleSort(field: SortField): void {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  function applyFilter(next: StatusFilter): void {
    setStatusFilter(next);
    if (meta.page !== 1) goToPage(1);
  }

  const totalPages = Math.max(meta.last_page, 1);
  const pageNumbers = buildPageNumbers(meta.page, totalPages);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      {/* Page Header */}
      <div className="mb-8 sm:mb-10">
        <nav className="mb-3 text-sm text-slate-500" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link to="/citizen" className="hover:text-slate-900 transition-colors">
                Portal
              </Link>
            </li>
            <li aria-hidden className="text-slate-300">
              /
            </li>
            <li className="font-medium text-slate-700">My Reports</li>
          </ol>
        </nav>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              My Reports
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Track and manage your submitted service requests
            </p>
          </div>
          <Link
            to="/citizen/submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            New Report
          </Link>
        </div>
      </div>

      {/* Loading State */}
      {reports.isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner label="Loading your reports" />
        </div>
      ) : reports.isError || !reports.data ? (
        <EmptyState
          title="Unable to load reports"
          description="We couldn't retrieve your reports. Please check your connection and try again."
        />
      ) : reports.data.data.length === 0 ? (
        /* Empty State */
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <FileText className="h-8 w-8 text-slate-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">No reports yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500 leading-relaxed">
            When you submit a service request, it will appear here with a tracking number so you can
            follow its progress.
          </p>
          <Link
            to="/citizen/submit"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            Submit Your First Report
          </Link>
        </div>
      ) : (
        <>
          {/* Filter Pills */}
          <div className="mb-6 sm:mb-8">
            <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
              <div
                role="tablist"
                aria-label="Filter reports by status"
                className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
              >
                {FILTER_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === tab.key}
                    onClick={() => applyFilter(tab.key)}
                    className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${
                      statusFilter === tab.key
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile: Card List */}
          <div className="space-y-3 lg:hidden">
            {filteredReports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden lg:block">
            <Table className="rounded-xl shadow-sm">
              <THead>
                <TR>
                  <TH className="w-[170px]">
                    <button
                      type="button"
                      onClick={() => toggleSort('reference')}
                      className="group inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      Reference
                      <SortIcon active={sortField === 'reference'} dir={sortDir} />
                    </button>
                  </TH>
                  <TH>Service Request</TH>
                  <TH className="w-[140px]">
                    <button
                      type="button"
                      onClick={() => toggleSort('date')}
                      className="group inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      Filed On
                      <SortIcon active={sortField === 'date'} dir={sortDir} />
                    </button>
                  </TH>
                  <TH className="w-[150px]">
                    <button
                      type="button"
                      onClick={() => toggleSort('status')}
                      className="group inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      Status
                      <SortIcon active={sortField === 'status'} dir={sortDir} />
                    </button>
                  </TH>
                  <th className="w-[80px] px-4 py-3" />
                </TR>
              </THead>
              <TBody>
                {filteredReports.map((report) => (
                  <TR key={report.id} className="group">
                    <TD className="font-mono text-xs font-semibold tracking-wide text-slate-600">
                      {report.reference}
                    </TD>
                    <TD>
                      <span className="font-medium text-slate-900">{report.title}</span>
                      {report.type?.name && (
                        <p className="mt-0.5 text-xs text-slate-500">{report.type.name}</p>
                      )}
                      {report.location?.address && (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400">
                          <MapPin className="h-3 w-3" />
                          {report.location.address}
                        </p>
                      )}
                    </TD>
                    <TD className="text-sm text-slate-600">{formatDate(report.created_at)}</TD>
                    <TD>
                      <StatusBadge status={report.status} />
                    </TD>
                    <TD className="text-right">
                      <Link
                        to={`/citizen/reports/${report.id}`}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                      >
                        View
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          {/* Results Summary */}
          <p className="mt-4 text-xs text-slate-400 sm:mt-6">
            Showing {filteredReports.length} of {meta.total} report{meta.total === 1 ? '' : 's'}
            {statusFilter !== 'all' &&
              ` (${statusFilter === 'open' ? 'in progress' : 'resolved'} only)`}
          </p>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-5 flex items-center justify-center sm:mt-8">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => goToPage(meta.page - 1)}
                  disabled={meta.page <= 1}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                  <span className="hidden sm:inline">Previous</span>
                </button>

                <div className="flex items-center gap-0.5">
                  {pageNumbers.map((p, i) =>
                    p === '…' ? (
                      <span
                        key={`ellipsis-${i}`}
                        className="flex h-9 w-8 items-center justify-center text-sm text-slate-400"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => goToPage(p)}
                        aria-current={p === meta.page ? 'page' : undefined}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition ${
                          p === meta.page
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        {p}
                      </button>
                    ),
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => goToPage(meta.page + 1)}
                  disabled={meta.page >= totalPages}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </nav>
          )}

          {/* Help Section */}
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50/50 px-5 py-4 sm:mt-10">
            <div className="flex gap-3">
              <HelpCircle className="h-5 w-5 flex-shrink-0 text-slate-500 mt-0.5" />
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-700">Need help with a report?</p>
                <p className="mt-1 leading-relaxed">
                  Use the Reference ID when contacting support. Click &ldquo;View&rdquo; for the
                  full case timeline and any assigned actions.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
