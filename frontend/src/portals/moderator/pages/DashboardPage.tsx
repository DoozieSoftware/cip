import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardBody, Spinner, Badge, EmptyState } from '../design';
import { analyticsApi } from '../api/moderator';
import type { AnalyticsSummary } from '../types';

function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
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
  const { data, isLoading, error, refetch } = useQuery<AnalyticsSummary>({
    queryKey: ['moderator', 'analytics', 'summary'],
    queryFn: () => analyticsApi.summary(),
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
        description="The analytics summary endpoint did not respond. The backend may be unreachable or your session may have expired."
        action={
          <button
            type="button"
            onClick={() => { void refetch(); }}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            Retry
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Today at a glance</h1>
          <p className="text-sm text-slate-500">Live moderator queue health</p>
        </div>
        <Badge tone="info">Auto-refresh 30 s</Badge>
      </div>

      <section aria-label="Queue sizes" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Pending moderator" value={data.pending_moderator} />
        <MetricCard label="Duplicates pending" value={data.duplicates_pending} />
        <MetricCard label="Fraud pending" value={data.fraud_pending} />
        <MetricCard label="Avg review (min)" value={data.avg_review_minutes} hint="Last 24 h" />
      </section>

      <section aria-label="Today's outcomes" className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard label="Approved today" value={data.approved_today} />
        <MetricCard label="Rejected today" value={data.rejected_today} />
        <MetricCard label="Merged today" value={data.merged_today} />
        <MetricCard label="Escalated today" value={data.escalated_today} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>AI accuracy</CardTitle>
          <Badge tone={data.ai_accuracy_pct >= 90 ? 'success' : data.ai_accuracy_pct >= 75 ? 'warning' : 'danger'}>
            {data.ai_accuracy_pct.toFixed(1)}%
          </Badge>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-slate-600">
            Fraction of moderator decisions that agreed with the AI recommendation over the last 7 days. Lower scores
            indicate that the AI provider needs prompt tuning or a swap to a stronger model.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
