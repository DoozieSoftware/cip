import { useQuery } from '@tanstack/react-query';
import { Card, CardBody, Spinner, Badge, EmptyState } from '../design';
import { departmentApi } from '../api/operations';
import type { DepartmentDashboardCounts } from '../types';

function MetricCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardBody className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </CardBody>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useQuery<DepartmentDashboardCounts>({
    queryKey: ['operations', 'dashboard'],
    queryFn: async () => (await departmentApi.dashboard()).data,
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
            onClick={() => { void refetch(); }}
            className="text-sm font-medium text-emerald-600 hover:underline"
          >
            Retry
          </button>
        }
      />
    );
  }

  const categoryEntries = Object.entries(data.by_category ?? {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Department at a glance</h1>
          <p className="text-sm text-slate-500">Live operational load for the officer's department</p>
        </div>
        <Badge tone="info">Auto-refresh 30 s</Badge>
      </div>

      <section aria-label="Operational metrics" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Open reports" value={data.open} hint="Not yet closed" />
        <MetricCard label="Due today" value={data.due_today} hint="Submitted today, still open" />
        <MetricCard label="SLA breached" value={data.sla_breached} hint="Open more than a day" />
      </section>

      <section aria-label="By category" className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Open reports by category</h2>
        {categoryEntries.length === 0 ? (
          <EmptyState title="No open reports" description="Your department has no open reports." />
        ) : (
          <Card>
            <CardBody>
              <ul className="space-y-1 text-sm text-slate-700">
                {categoryEntries.map(([code, count]) => (
                  <li key={code} className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase tracking-wide text-slate-500">{code}</span>
                    <span className="font-semibold">{count}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}
      </section>
    </div>
  );
}
