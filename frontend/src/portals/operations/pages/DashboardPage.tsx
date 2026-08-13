import { useQuery } from '@tanstack/react-query';
import {
  IconAlertTriangle,
  IconCalendar,
  IconClock,
  IconFolder,
  IconListDetails,
  IconRefresh,
} from '@tabler/icons-react';
import { Card, CardBody, Spinner, EmptyState } from '../../../shared/ui';
import { departmentApi } from '../api/operations';
import { useDepartmentSelection } from '../context/DepartmentSelectionContext';
import type { DepartmentDashboardCounts } from '../types';

function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: 'default' | 'warning' | 'danger';
}) {
  const toneClasses: Record<string, { ring: string; icon: string }> = {
    default: {
      ring: 'ring-[#ecebe6]',
      icon: 'bg-[var(--color-canvas)] text-[var(--color-text-secondary)]',
    },
    warning: { ring: 'ring-amber-200', icon: 'bg-amber-50 text-amber-600' },
    danger: { ring: 'ring-red-200', icon: 'bg-red-50 text-red-600' },
  };
  const t = toneClasses[tone ?? 'default'];

  const Icon =
    tone === 'warning' ? IconCalendar : tone === 'danger' ? IconAlertTriangle : IconClock;

  return (
    <Card>
      <CardBody className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold leading-none text-[var(--color-ink)] tabular-nums">
            {value}
          </p>
          {hint && <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{hint}</p>}
        </div>
        <span
          aria-hidden
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ring-1 ring-inset ${t.icon} ${t.ring}`}
        >
          <Icon className="h-5 w-5" stroke={1.6} />
        </span>
      </CardBody>
    </Card>
  );
}

export default function DashboardPage() {
  const { selectedId, ready, memberships } = useDepartmentSelection();
  const { data, isLoading, error, refetch } = useQuery<DepartmentDashboardCounts>({
    queryKey: ['operations', 'dashboard', selectedId],
    queryFn: () => departmentApi.dashboard({ department_id: selectedId ?? undefined }),
    enabled: ready && memberships.length > 0,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20" aria-live="polite">
        <Spinner label="Loading dashboard" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Could not load the dashboard"
        description="The department dashboard endpoint did not respond. The backend may be unreachable or your session may have expired."
        action={
          <button
            type="button"
            onClick={() => {
              void refetch();
            }}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-2"
          >
            <IconRefresh className="h-4 w-4" stroke={1.6} />
            Retry
          </button>
        }
      />
    );
  }

  const categoryEntries = Object.entries(data.by_category ?? {});

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <IconListDetails className="h-5 w-5 text-[var(--color-text-tertiary)]" stroke={1.6} />
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            Live overview
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
          Department at a glance
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Operational load for the officer&apos;s department
        </p>
      </div>

      {/* Metrics */}
      <section
        aria-label="Operational metrics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <MetricCard label="Open reports" value={data.open} hint="Not yet closed" />
        <MetricCard
          label="Due today"
          value={data.due_today}
          hint="Submitted today, still open"
          tone="warning"
        />
        <MetricCard
          label="Overdue reports"
          value={data.sla_breached}
          hint="Open more than a day"
          tone="danger"
        />
      </section>

      {/* Category breakdown */}
      <section aria-label="By category" className="space-y-4">
        <div className="flex items-center gap-2">
          <IconFolder className="h-4 w-4 text-[var(--color-text-tertiary)]" stroke={1.6} />
          <h2 className="text-sm font-medium text-[var(--color-ink)]">Open reports by category</h2>
        </div>

        {categoryEntries.length === 0 ? (
          <Card>
            <CardBody>
              <div className="flex flex-col items-center justify-center gap-1 py-6 text-center">
                <p className="text-sm font-medium text-[var(--color-ink)]">No open reports</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Your department has no open reports.
                </p>
              </div>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody className="divide-y divide-[#ecebe6]">
              {categoryEntries.map(([code, count]) => {
                const maxCount = Math.max(...categoryEntries.map(([, c]) => c), 1);
                const pct = Math.round((count / maxCount) * 100);
                return (
                  <div key={code} className="flex items-center gap-4 py-3">
                    <span className="w-32 shrink-0 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      {code}
                    </span>
                    <div className="flex-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#ecebe6]">
                        <div
                          className="h-full rounded-full bg-[var(--color-ink)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-[var(--color-ink)]">
                      {count}
                    </span>
                  </div>
                );
              })}
            </CardBody>
          </Card>
        )}
      </section>
    </div>
  );
}
