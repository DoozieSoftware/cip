import { type JSX } from 'react';
import { usePublicStats } from '../api/client';
import { Spinner, EmptyState } from '../../../shared/ui';

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining === 0 ? `${minutes}m` : `${minutes}m ${remaining}s`;
}

export default function OverviewPage(): JSX.Element {
  const stats = usePublicStats();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Platform overview</h1>
        <p className="mt-1 text-sm text-slate-600">
          Live, aggregate statistics for public reports. Values are cached for five minutes and
          exclude drafts, rejected reports, and merged duplicates.
        </p>
      </header>

      {stats.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner label="Loading statistics" />
        </div>
      ) : stats.isError || !stats.data ? (
        <EmptyState title="Statistics unavailable" description="Please try again shortly." />
      ) : (
        <div className="grid grid-cols-1 gap-6 rounded-3xl border border-slate-200 bg-white p-8 sm:grid-cols-3">
          <Stat
            label="Reports processed"
            value={stats.data.total_reports.toLocaleString()}
            sub="all time"
          />
          <p className="col-span-full text-center text-xs text-slate-500">
            {stats.data.generated_at
              ? `Generated ${new Date(stats.data.generated_at).toLocaleString()}`
              : 'Freshness timestamp unavailable'}
          </p>
          <Stat
            label="AI-classified"
            value={`${stats.data.ai_classified_percent}%`}
            sub="before human review"
          />
          <Stat
            label="Median time to assign"
            value={formatDuration(stats.data.median_assign_seconds)}
            sub="submit → department"
          />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }): JSX.Element {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold tracking-tight text-brand-700 sm:text-4xl">{value}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{label}</div>
      <div className="text-xs text-slate-500">{sub}</div>
    </div>
  );
}
