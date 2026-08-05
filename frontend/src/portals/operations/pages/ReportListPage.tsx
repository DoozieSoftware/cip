import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Spinner, EmptyState, Badge } from '../design';
import { api } from '../api/client';
import { departmentApi, type ReportListFilters } from '../api/operations';
import { ExportMenu } from '../components/ExportMenu';
import { SlaBadge } from '../components/SlaBadge';
import { statusLabel, statusTone } from '../components/statusMeta';
import { useReverseGeocode } from '../../../shared/geo/useReverseGeocode';
import { useDepartmentSelection } from '../context/DepartmentSelectionContext';
import type { DepartmentReportListItem, Paginated, ReportType } from '../types';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'verified', label: 'Verified' },
  { value: 'closed', label: 'Closed' },
  { value: 'escalated', label: 'Escalated' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'Any priority' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const PRIORITY_TONE: Record<string, 'danger' | 'warning' | 'neutral'> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
};

const NEXT_ACTION: Record<string, string> = {
  assigned: 'Accept assignment',
  accepted: 'Start field work',
  in_progress: 'Update or resolve',
  resolved: 'Close after proof check',
  verified: 'Verified',
  closed: 'Closed',
  escalated: 'Supervisor attention',
  merged: 'Merged',
};

function relativeDate(value: string | null): string {
  if (!value) return '—';
  const created = new Date(value).getTime();
  if (Number.isNaN(created)) return '—';
  const days = Math.max(0, Math.floor((Date.now() - created) / 86_400_000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function looksLikeCoords(address: string): boolean {
  return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(address.trim());
}

function ReportLocationText({ location }: { location: DepartmentReportListItem['location'] }) {
  const providedAddress =
    location?.address && !looksLikeCoords(location.address) ? location.address : null;
  const geocodedAddress = useReverseGeocode(
    location?.lat ?? Number.NaN,
    location?.lng ?? Number.NaN,
    providedAddress,
  );

  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-600">
      <span aria-hidden className="text-emerald-700">
        •
      </span>
      <span className="truncate">
        {providedAddress ??
          (geocodedAddress || (location ? 'Location captured' : 'Location unavailable'))}
      </span>
    </p>
  );
}

function useReportTypeOptions() {
  return useQuery({
    queryKey: ['operations', 'report-types'],
    queryFn: async (): Promise<ReportType[]> => {
      const res = await api.get<{ success: boolean; data: ReportType[] }>('/report-types');
      return res.data;
    },
  });
}

export default function ReportListPage() {
  const { selectedId, ready, memberships } = useDepartmentSelection();
  const location = useLocation();
  const secondaryOnly = location.pathname === '/operations/tasks';
  const selectedDepartment = memberships.find((membership) => membership.id === selectedId);
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState<ReportListFilters>(() => ({
    status: params.get('status') ?? '',
    priority: params.get('priority') ?? '',
    category: params.get('category') ?? '',
    search: params.get('search') ?? '',
    date_from: params.get('date_from') ?? '',
    date_to: params.get('date_to') ?? '',
    assignment_kind: secondaryOnly ? 'secondary' : undefined,
    page: params.get('page') ? Math.max(1, Number(params.get('page')) || 1) : 1,
    per_page: 20,
  }));
  const [filtersOpen, setFiltersOpen] = useState(false);

  const reportTypes = useReportTypeOptions();

  const scopedFilters: ReportListFilters = {
    ...filters,
    assignment_kind: secondaryOnly ? 'secondary' : undefined,
    department_id: selectedId ?? undefined,
  };

  const { data, isLoading, error, refetch } = useQuery<Paginated<DepartmentReportListItem>>({
    queryKey: ['operations', 'reports', scopedFilters],
    queryFn: () => departmentApi.listReports(scopedFilters),
    enabled: ready && memberships.length > 0,
  });

  function updateFilter<K extends keyof ReportListFilters>(key: K, value: ReportListFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
    setParams((p) => {
      if (value === undefined || value === null || value === '') p.delete(String(key));
      else p.set(String(key), String(value));
      p.delete('page');
      return p;
    });
  }

  function goToPage(page: number) {
    setFilters((prev) => ({ ...prev, page }));
    setParams((p) => {
      if (page <= 1) p.delete('page');
      else p.set('page', String(page));
      return p;
    });
  }

  function clearFilters() {
    setFilters({
      status: '',
      priority: '',
      category: '',
      search: '',
      date_from: '',
      date_to: '',
      assignment_kind: secondaryOnly ? 'secondary' : undefined,
      page: 1,
      per_page: 20,
    });
    setParams({});
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20" aria-live="polite">
        <Spinner label="Loading reports" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Could not load reports"
        description="The reports endpoint did not respond."
        action={
          <button
            type="button"
            onClick={() => {
              void refetch();
            }}
            className="text-sm font-medium text-emerald-600 hover:underline"
          >
            Retry
          </button>
        }
      />
    );
  }

  const needsAction = data.data.filter((r) => {
    const status = r.assignment?.kind === 'secondary' ? r.assignment.status : r.current_status_code;
    return ['open', 'assigned', 'accepted', 'in_progress', 'resolved'].includes(status ?? '');
  }).length;
  const resolved = data.data.filter((r) =>
    ['resolved', 'verified', 'closed'].includes(r.current_status_code ?? ''),
  ).length;
  const overdue = data.data.filter((r) => {
    const isSecondary = r.assignment?.kind === 'secondary';
    const startAt = isSecondary ? r.assignment?.assigned_at : r.created_at;
    const slaMinutes = isSecondary ? r.assignment?.sla_minutes : r.department_sla_minutes;
    const status = isSecondary ? r.assignment?.status : r.current_status_code;
    if (
      !startAt ||
      !slaMinutes ||
      ['completed', 'cancelled', 'resolved', 'verified', 'closed'].includes(status ?? '')
    )
      return false;
    return new Date(startAt).getTime() + slaMinutes * 60_000 < Date.now();
  }).length;
  const activeFilterCount = [
    filters.status,
    filters.priority,
    filters.category,
    filters.search,
    filters.date_from,
    filters.date_to,
  ].filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {secondaryOnly ? 'Secondary work queue' : 'Officer queue'}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">
            {secondaryOnly ? 'Secondary tasks' : 'Assigned reports'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {secondaryOnly
              ? 'Complete linked work without changing the primary report workflow.'
              : "Reports and linked tasks that are already in your department's hands."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!secondaryOnly && <ExportMenu filters={scopedFilters} />}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 sm:gap-x-3 sm:text-sm">
        <span className="font-semibold text-slate-950">{data.meta.total} reports</span>
        <span aria-hidden>·</span>
        <span>
          <strong className="font-semibold text-slate-900">{needsAction}</strong> action
        </span>
        <span aria-hidden>·</span>
        <span>
          <strong className="font-semibold text-red-600">{overdue}</strong> overdue
        </span>
        <span aria-hidden>·</span>
        <span>
          <strong className="font-semibold text-emerald-700">{resolved}</strong> resolved
        </span>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex gap-2 p-2.5 sm:p-3">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search reports</span>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"
            >
              ⌕
            </span>
            <input
              name="search"
              type="search"
              placeholder="Search title or report number"
              value={filters.search ?? ''}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
              filtersOpen || activeFilterCount > 0
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span aria-hidden>☷</span>
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-emerald-700 px-1 text-[11px] text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {filtersOpen && (
          <div className="border-t border-slate-100 px-3 pb-3 pt-2.5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label>
                <span className="sr-only">Status</span>
                <select
                  name="status"
                  value={filters.status ?? ''}
                  onChange={(e) => updateFilter('status', e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.value ? `Status: ${option.label}` : 'All statuses'}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Priority</span>
                <select
                  name="priority"
                  value={filters.priority ?? ''}
                  onChange={(e) => updateFilter('priority', e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Category</span>
                <select
                  name="category"
                  value={filters.category ?? ''}
                  onChange={(e) => updateFilter('category', e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">All categories</option>
                  {(reportTypes.data ?? []).map((type) => (
                    <option key={type.id} value={type.code}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="min-w-[140px] flex-1">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  From date
                </span>
                <input
                  name="date_from"
                  type="date"
                  value={filters.date_from ?? ''}
                  onChange={(e) => updateFilter('date_from', e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="min-w-[140px] flex-1">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  To date
                </span>
                <input
                  name="date_to"
                  type="date"
                  value={filters.date_to ?? ''}
                  onChange={(e) => updateFilter('date_to', e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="h-10 rounded-xl px-3 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {data.data.length === 0 ? (
        <EmptyState title="No reports match" description="Try clearing your filters." />
      ) : (
        <div className="space-y-3">
          {data.data.map((r, index) => (
            <article
              key={r.id}
              className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
            >
              <Link
                to={`/operations/reports/${r.id}${selectedId ? `?department_id=${encodeURIComponent(selectedId)}` : ''}`}
                className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 gap-3 sm:gap-4">
                    <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-lg font-semibold text-white sm:flex">
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={r.assignment?.kind === 'secondary' ? 'purple' : 'neutral'}>
                          {r.assignment?.kind === 'secondary' ? 'Secondary task' : 'Primary report'}
                        </Badge>
                        <Badge
                          tone={
                            r.assignment?.kind === 'secondary'
                              ? r.assignment.status === 'completed'
                                ? 'success'
                                : 'info'
                              : statusTone(r.current_status_code)
                          }
                        >
                          {r.assignment?.kind === 'secondary'
                            ? statusLabel(r.assignment.status)
                            : statusLabel(r.current_status_code)}
                        </Badge>
                        {r.priority && (
                          <Badge tone={PRIORITY_TONE[r.priority.code] ?? 'neutral'}>
                            {r.priority.name}
                          </Badge>
                        )}
                        <Badge tone="neutral">
                          {r.report_type?.name ?? r.report_type?.code ?? '—'}
                        </Badge>
                      </div>
                      <h2 className="mt-2 line-clamp-2 text-base font-semibold text-slate-950 group-hover:text-emerald-700 lg:truncate">
                        {r.title}
                      </h2>
                      <p className="mt-1 font-mono text-xs text-slate-500">{r.tracking_number}</p>
                      <ReportLocationText location={r.location} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:w-[520px]">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Deadline</p>
                      <div className="mt-1">
                        <SlaBadge report={r} assignment={r.assignment} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Department</p>
                      <p className="mt-1 truncate font-medium text-slate-700">
                        {r.assignment?.kind === 'secondary'
                          ? (selectedDepartment?.name ?? 'Selected department')
                          : (r.department?.name ?? '—')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Reported</p>
                      <p className="mt-1 font-medium text-slate-700">
                        {relativeDate(r.submitted_at)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Next step</p>
                      <p className="mt-1 font-medium text-slate-700">
                        {r.assignment?.kind === 'secondary'
                          ? 'Complete task'
                          : (NEXT_ACTION[r.current_status_code ?? ''] ?? 'Review')}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Page {data.meta.current_page} of {data.meta.last_page} ({data.meta.per_page} per page)
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={data.meta.current_page <= 1}
            onClick={() => goToPage((filters.page ?? 1) - 1)}
            className="rounded border border-slate-300 px-3 py-1 text-xs font-medium disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={data.meta.current_page >= data.meta.last_page}
            onClick={() => goToPage((filters.page ?? 1) + 1)}
            className="rounded border border-slate-300 px-3 py-1 text-xs font-medium disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
