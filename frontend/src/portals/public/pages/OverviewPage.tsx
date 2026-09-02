import { type JSX } from 'react';
import { usePublicStats } from '../api/client';
import { Card, EmptyState, Spinner } from '../../../shared/ui';

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
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
          Platform overview
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Live, aggregate statistics for public complaints. Values are cached for five minutes and
          exclude drafts, rejected complaints, and merged duplicates.
        </p>
      </header>

      {stats.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner label="Loading statistics" />
        </div>
      ) : stats.isError || !stats.data ? (
        <EmptyState title="Statistics unavailable" description="Please try again shortly." />
      ) : (
        <Card className="grid grid-cols-1 gap-6 p-8 sm:grid-cols-3">
          <Stat
            label="Complaints processed"
            value={stats.data.total_reports.toLocaleString()}
            sub="all time"
          />
          <p className="col-span-full text-center text-xs text-[var(--color-text-secondary)]">
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
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }): JSX.Element {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold tracking-tight text-[var(--color-ink)] sm:text-4xl">
        {value}
      </div>
      <div className="mt-1 text-sm font-semibold text-[var(--color-ink)]">{label}</div>
      <div className="text-xs text-[var(--color-text-secondary)]">{sub}</div>
    </div>
  );
}
