import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { JSX, ReactNode } from 'react';
import { IconChevronLeft, IconChevronRight, IconSearch, IconX } from '@tabler/icons-react';
import { EmptyState, ErrorState, Spinner, cx } from '../../../../shared/ui';
import { useDepartmentSelection } from '../../context/DepartmentSelectionContext';
import {
  fetchTextileQueue,
  fetchTextileZones,
  type TextileCollectionListItem,
} from '../../api/textileApi';

export const PER_PAGE = 25;
export const OPERATIONS_QUEUE_REFRESH_MS = 30_000;

export const STATUS_LABELS: Record<string, string> = {
  pending_review: 'Needs review',
  ready_to_group: 'Ready to schedule',
  scheduled: 'Scheduled',
  picked_up: 'Collected',
  missed: 'Missed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const CATEGORY_LABELS: Record<string, string> = {
  clothes_waste: 'Clothes & Textiles',
  metal_scrap: 'Metal Scrap',
  e_waste: 'E-Waste',
};

export const STATUS_STYLES: Record<string, string> = {
  pending_review: 'bg-amber-50 text-amber-800',
  ready_to_group: 'bg-blue-50 text-blue-800',
  scheduled: 'bg-indigo-50 text-indigo-800',
  picked_up: 'bg-emerald-50 text-emerald-800',
  missed: 'bg-orange-50 text-orange-800',
  rejected: 'bg-rose-50 text-rose-800',
  cancelled: 'bg-neutral-100 text-neutral-600',
};

/** Department gating + ids shared by every textile desk page. */
export function useDesk(): {
  ready: boolean;
  isDrLinen: boolean;
  departmentId: string | undefined;
} {
  const { memberships, selectedId, ready } = useDepartmentSelection();
  const selectedDepartment = memberships.find((item) => item.id === selectedId);
  return {
    ready,
    isDrLinen: selectedDepartment?.code === 'DR_LINEN',
    departmentId: selectedId ?? undefined,
  };
}

/** Active service zones, cached for the session. */
export function useTextileZones() {
  return useQuery({
    queryKey: ['operations', 'textile', 'zones'],
    queryFn: fetchTextileZones,
    staleTime: 5 * 60_000,
  });
}

/** "3 bags · 8.5 kg" / "3 bags" / "8.5 kg" / "—" — null-safe for optional estimates. */
export function formatVolume(bags: number | null, weightKg: number | null): string {
  const parts: string[] = [];
  if (bags !== null) parts.push(`${bags} bag${bags === 1 ? '' : 's'}`);
  if (weightKg !== null) parts.push(`${weightKg} kg`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

interface QueueArgs {
  status: string;
  search: string;
  page: number;
  zoneId?: string;
  categoryId?: string;
  enabled: boolean;
  departmentId?: string;
  /** Pause updates while an officer has selections or a form in progress. */
  autoRefresh?: boolean;
}

export function useTextileQueue(args: QueueArgs): UseQueryResult<{
  data: TextileCollectionListItem[];
  meta: { page: number; per_page: number; total: number; last_page: number };
}> {
  const {
    status,
    search,
    page,
    zoneId,
    categoryId,
    enabled,
    departmentId,
    autoRefresh = true,
  } = args;
  return useQuery({
    queryKey: ['operations', 'textile', status, departmentId, zoneId, categoryId, search, page],
    queryFn: () =>
      fetchTextileQueue({
        department_id: departmentId,
        status: status || undefined,
        search: search || undefined,
        service_zone_id: zoneId || undefined,
        category: categoryId || undefined,
        per_page: PER_PAGE,
        page,
      }),
    enabled,
    placeholderData: (previous) => previous,
    // Queues change while another officer or field worker acts. Refresh them
    // without making officers hunt for a manual toolbar control; pages pause
    // this while selection or form data is in progress.
    refetchInterval: autoRefresh ? OPERATIONS_QUEUE_REFRESH_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: autoRefresh,
    refetchOnReconnect: autoRefresh,
  });
}

/** Page chrome: guards + heading + toolbar slot + content. */
export function DeskPage({
  title,
  description,
  toolbar,
  children,
  desk,
}: {
  title: string;
  description: string;
  toolbar?: ReactNode;
  children: ReactNode;
  desk: { ready: boolean; isDrLinen: boolean };
}): JSX.Element {
  if (!desk.ready)
    return (
      <div className="py-20">
        <Spinner label="Loading department" />
      </div>
    );

  if (!desk.isDrLinen) {
    return (
      <EmptyState
        title="Dr. Linen collection workspace"
        description="Switch the working department to Dr. Linen to manage textile pickups."
      />
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <header className="border-b border-[var(--color-border-faint)] pb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
          Dr. Linen operations
        </p>
        <h1 className="mt-1 text-2xl font-normal tracking-[-0.03em]">{title}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p>
      </header>
      {toolbar}
      {children}
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder = 'Search reference, name, phone',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}): JSX.Element {
  return (
    <div className="relative w-full max-w-xs">
      <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label="Search pickup requests"
        className="min-h-10 w-full rounded-full border border-black/15 bg-white pl-9 pr-8 text-sm"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-[var(--color-surface-alt)]"
        >
          <IconX className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function ZoneFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}): JSX.Element {
  const zones = useTextileZones();
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Filter by service zone"
      className="min-h-10 rounded-full border border-black/15 bg-white px-4 text-sm"
    >
      <option value="">All zones</option>
      {(zones.data ?? []).map((zone) => (
        <option key={zone.id} value={zone.id}>
          {zone.name}
        </option>
      ))}
    </select>
  );
}

export function CategoryFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}): JSX.Element {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Filter by category"
      className="min-h-10 rounded-full border border-black/15 bg-white px-4 text-sm"
    >
      <option value="">All categories</option>
      {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}

export function CategoryBadge({ category }: { category: string }): JSX.Element | null {
  const label = CATEGORY_LABELS[category];
  if (!label) return null;
  return (
    <span className="font-mono text-[9px] uppercase tracking-[0.1em] rounded px-1.5 py-0.5 bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]">
      {label}
    </span>
  );
}

export function TableShell({
  head,
  children,
}: {
  head: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-xl border border-black/10 bg-white">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-black/10 bg-[var(--color-surface-alt)] text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            {head}
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">{children}</tbody>
      </table>
    </div>
  );
}

export function DeskStates({
  loading,
  error,
  emptyTitle,
  emptyBody,
  onRetry,
  hasRows,
  children,
}: {
  loading: boolean;
  error: boolean;
  emptyTitle: string;
  emptyBody: string;
  onRetry: () => void;
  hasRows: boolean;
  children: ReactNode;
}): JSX.Element | null {
  if (loading)
    return (
      <div className="py-16">
        <Spinner label="Loading requests" />
      </div>
    );
  if (error)
    return (
      <ErrorState
        title="Could not load requests"
        description="Please retry the collection queue."
        action={
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full border border-black/15 px-4 py-2 text-sm"
          >
            Retry
          </button>
        }
      />
    );
  if (!hasRows) return <EmptyState title={emptyTitle} description={emptyBody} />;
  return <>{children}</>;
}

export function Pager({
  meta,
  onPage,
}: {
  meta: { page: number; total: number; last_page: number } | undefined;
  onPage: (page: number) => void;
}): JSX.Element | null {
  if (!meta || meta.total <= PER_PAGE) return null;
  return (
    <nav
      className="flex items-center justify-between border-t border-[var(--color-border-faint)] pt-4"
      aria-label="Pagination"
    >
      <p className="text-xs text-[var(--color-text-secondary)]">
        {meta.total} request{meta.total === 1 ? '' : 's'} · page {meta.page} of {meta.last_page}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={meta.page <= 1}
          onClick={() => onPage(Math.max(1, meta.page - 1))}
          className="inline-flex min-h-9 items-center gap-1 rounded-full border border-black/15 bg-white px-3 text-sm disabled:opacity-40"
        >
          <IconChevronLeft className="h-4 w-4" /> Prev
        </button>
        <button
          type="button"
          disabled={meta.page >= meta.last_page}
          onClick={() => onPage(meta.page + 1)}
          className="inline-flex min-h-9 items-center gap-1 rounded-full border border-black/15 bg-white px-3 text-sm disabled:opacity-40"
        >
          Next <IconChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

export function StatusBadge({ status }: { status: string }): JSX.Element {
  return (
    <span
      className={cx(
        'rounded-full px-2.5 py-1 text-[11px] font-medium',
        STATUS_STYLES[status] ?? 'bg-neutral-100',
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
