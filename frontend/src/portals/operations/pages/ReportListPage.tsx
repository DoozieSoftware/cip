import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  IconSearch,
  IconFilter,
  IconX,
  IconMapPin,
  IconArrowRight,
  IconChevronLeft,
  IconChevronRight,
} from '@tabler/icons-react';
import { Spinner, EmptyState, Badge } from '../../../shared/ui';
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
  { value: 'assigned', label: statusLabel('assigned') },
  { value: 'accepted', label: statusLabel('accepted') },
  { value: 'in_progress', label: statusLabel('in_progress') },
  { value: 'resolved', label: statusLabel('resolved') },
  { value: 'resolved_pending_verification', label: statusLabel('resolved_pending_verification') },
  { value: 'reopened', label: statusLabel('reopened') },
  { value: 'verified', label: statusLabel('verified') },
  { value: 'closed', label: statusLabel('closed') },
  { value: 'escalated', label: statusLabel('escalated') },
];

const NEXT_ACTION: Record<string, string> = {
  assigned: 'Accept assignment',
  accepted: 'Start field work',
  in_progress: 'Update or resolve',
  resolved: 'Review fix proof',
  resolved_pending_verification: 'Waiting for citizen',
  reopened: 'Resume work',
  verified: 'Citizen confirmed',
  closed: 'Completed',
  escalated: 'Supervisor attention',
  merged: 'Merged duplicate',
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
    <div className="mt-1.5 flex items-center gap-1.5">
      <IconMapPin size={12} stroke={1.6} className="shrink-0 text-[var(--color-text-tertiary)]" />
      <span className="truncate text-xs text-[var(--color-text-tertiary)]">
        {providedAddress ??
          (geocodedAddress || (location ? 'Location captured' : 'Location unavailable'))}
      </span>
    </div>
  );
}

function useReportTypeOptions() {
  return useQuery({
    queryKey: ['operations', 'report-types'],
    queryFn: async (): Promise<ReportType[]> => {
      return api.get<ReportType[]>('/report-types');
    },
  });
}

export default function ReportListPage() {
  const { selectedId, ready, memberships } = useDepartmentSelection();
  const location = useLocation();
  const secondaryOnly = location.pathname === '/operations/tasks';
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState<ReportListFilters>(() => ({
    status: params.get('status') ?? '',
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
            className="text-sm font-medium text-[var(--color-ink)] underline underline-offset-2"
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
    filters.category,
    filters.search,
    filters.date_from,
    filters.date_to,
  ].filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
            {secondaryOnly ? 'Cross Agency' : 'Officer queue'}
          </p>
          <h1 className="mt-1 text-xl font-semibold text-[var(--color-ink)]">
            {secondaryOnly ? 'Cross Agency' : 'Assigned reports'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!secondaryOnly && <ExportMenu filters={scopedFilters} />}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 text-xs text-[var(--color-text-secondary)]">
        <span className="font-semibold text-[var(--color-ink)]">{data.meta.total} reports</span>
        <span aria-hidden className="text-[var(--color-text-tertiary)]">
          |
        </span>
        <span>
          <strong className="font-semibold text-[var(--color-ink)]">{needsAction}</strong> action
        </span>
        <span aria-hidden className="text-[var(--color-text-tertiary)]">
          |
        </span>
        <span>
          <strong className="font-semibold text-red-600">{overdue}</strong> overdue
        </span>
        <span aria-hidden className="text-[var(--color-text-tertiary)]">
          |
        </span>
        <span>
          <strong className="font-semibold text-emerald-700">{resolved}</strong> fixed
        </span>
      </div>

      <div className="rounded-xl bg-white p-3">
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search reports</span>
            <IconSearch
              size={16}
              stroke={1.6}
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-3 my-auto text-[var(--color-text-tertiary)]"
            />
            <input
              name="search"
              type="search"
              placeholder="Search title or report number"
              value={filters.search ?? ''}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="h-10 w-full rounded-full border-0 bg-[var(--color-canvas)] pl-9 pr-3 text-sm text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-text-tertiary)] focus:ring-2 focus:ring-[var(--color-ink)]/10"
            />
          </label>
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition ${
              filtersOpen || activeFilterCount > 0
                ? 'bg-[var(--color-ink)] text-white'
                : 'bg-[var(--color-canvas)] text-[var(--color-ink)]'
            }`}
          >
            <IconFilter size={14} stroke={1.6} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white/20 px-1 text-[10px] font-semibold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {filtersOpen && (
          <div className="mt-3 border-t border-[var(--color-canvas)] pt-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label>
                <span className="sr-only">Status</span>
                <select
                  name="status"
                  value={filters.status ?? ''}
                  onChange={(e) => updateFilter('status', e.target.value)}
                  className="h-9 w-full rounded-full border-0 bg-[var(--color-canvas)] px-4 text-sm text-[var(--color-ink)] outline-none focus:ring-2 focus:ring-[var(--color-ink)]/10"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.value ? `Status: ${option.label}` : 'All statuses'}
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
                  className="h-9 w-full rounded-full border-0 bg-[var(--color-canvas)] px-4 text-sm text-[var(--color-ink)] outline-none focus:ring-2 focus:ring-[var(--color-ink)]/10"
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
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  From date
                </span>
                <input
                  name="date_from"
                  type="date"
                  value={filters.date_from ?? ''}
                  onChange={(e) => updateFilter('date_from', e.target.value)}
                  className="h-9 w-full rounded-full border-0 bg-[var(--color-canvas)] px-4 text-sm text-[var(--color-ink)] outline-none focus:ring-2 focus:ring-[var(--color-ink)]/10"
                />
              </label>
              <label className="min-w-[140px] flex-1">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  To date
                </span>
                <input
                  name="date_to"
                  type="date"
                  value={filters.date_to ?? ''}
                  onChange={(e) => updateFilter('date_to', e.target.value)}
                  className="h-9 w-full rounded-full border-0 bg-[var(--color-canvas)] px-4 text-sm text-[var(--color-ink)] outline-none focus:ring-2 focus:ring-[var(--color-ink)]/10"
                />
              </label>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <IconX size={14} stroke={1.6} />
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {data.data.length === 0 ? (
        <EmptyState title="No reports match" description="Try clearing your filters." />
      ) : (
        <div className="space-y-3">
          {data.data.map((r) => (
            <Link
              key={r.id}
              to={`/operations/reports/${r.id}${selectedId ? `?department_id=${encodeURIComponent(selectedId)}` : ''}`}
              className="group block rounded-xl bg-white p-4 transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={r.assignment?.kind === 'secondary' ? 'purple' : 'neutral'}>
                      {r.assignment?.kind === 'secondary'
                        ? 'Cross Agency report'
                        : 'Primary report'}
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
                  </div>
                  <h2 className="mt-2 line-clamp-1 text-sm font-semibold text-[var(--color-ink)] group-hover:underline">
                    {r.title}
                  </h2>
                  <p className="mt-0.5 font-mono text-[11px] text-[var(--color-text-tertiary)]">
                    {r.tracking_number}
                  </p>
                  <ReportLocationText location={r.location} />
                </div>
                <div className="flex shrink-0 items-center gap-6 text-xs lg:gap-8">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      Due target
                    </p>
                    <div className="mt-1">
                      <SlaBadge report={r} assignment={r.assignment} />
                    </div>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      Reported
                    </p>
                    <p className="mt-1 text-[var(--color-text-secondary)]">
                      {relativeDate(r.submitted_at)}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      Next step
                    </p>
                    <p className="mt-1 text-[var(--color-text-secondary)]">
                      {r.assignment?.kind === 'secondary'
                        ? 'Complete task'
                        : (NEXT_ACTION[r.current_status_code ?? ''] ?? 'Review')}
                    </p>
                  </div>
                  <IconArrowRight
                    size={16}
                    stroke={1.6}
                    className="hidden text-[var(--color-text-tertiary)] transition group-hover:translate-x-0.5 group-hover:text-[var(--color-ink)] lg:block"
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {data.meta.last_page > 1 && (
        <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
          <span className="font-mono text-[11px]">
            {data.meta.current_page} / {data.meta.last_page}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={data.meta.current_page <= 1}
              onClick={() => goToPage((filters.page ?? 1) - 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)] disabled:opacity-30"
            >
              <IconChevronLeft size={16} stroke={1.6} />
            </button>
            <button
              type="button"
              disabled={data.meta.current_page >= data.meta.last_page}
              onClick={() => goToPage((filters.page ?? 1) + 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[var(--color-ink)] transition hover:bg-[var(--color-canvas)] disabled:opacity-30"
            >
              <IconChevronRight size={16} stroke={1.6} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
