import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Spinner, EmptyState } from '../../../shared/ui';
import { staffReportStatusLabel } from '../../../shared/statusDisplay';
import { analyticsApi, queueApi } from '../api/moderator';
import type { AnalyticsSummary, ReportListItem } from '../types';
import {
  IconArrowRight,
  IconCheck,
  IconClock,
  IconEye,
  IconFingerprint,
  IconLink,
  IconTrendingUp,
} from '@tabler/icons-react';

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof IconClock;
}) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between gap-2">
        {/* Long single-word labels ("Misrepresentation") are wider than a
            two-up card at 360px and cannot wrap — truncate instead of
            letting them push the grid past the viewport. */}
        <span
          title={label}
          className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]"
        >
          {label}
        </span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#f3f2ed]">
          <Icon className="h-4 w-4" stroke={1.6} />
        </span>
      </div>
      <div className="mt-3 text-2xl font-semibold text-[#1d1d1b] tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-[#85847f]">{hint}</div>}
    </div>
  );
}

function QueueRow({ item, onSelect }: { item: ReportListItem; onSelect: (id: string) => void }) {
  const category = item.category?.name ?? 'Uncategorized';
  const aiConfidence = item.ai_confidence != null ? `${item.ai_confidence.toFixed(0)}%` : '—';

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-[#f3f2ed]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#1d1d1b]">{item.title}</p>
        <p className="truncate text-xs text-[#6f6e69]">
          {category} &middot; {item.tracking_number}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
          AI {aiConfidence}
        </span>
        <IconArrowRight className="h-4 w-4 text-[#85847f]" stroke={1.6} />
      </div>
    </button>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useQuery<AnalyticsSummary>({
    queryKey: ['moderator', 'analytics', 'summary'],
    queryFn: () => analyticsApi.summary(),
    refetchInterval: 30_000,
  });

  const { data: recentQueue } = useQuery<ReportListItem[]>({
    queryKey: ['moderator', 'queue', 'recent'],
    queryFn: async () => {
      const result = await queueApi.list({ per_page: 5 });
      return result.data;
    },
    refetchInterval: 30_000,
  });

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-20" aria-live="polite">
        <Spinner label="Loading dashboard" />
      </div>
    );
  }

  if (statsError || !stats) {
    return (
      <EmptyState
        title="Could not load the dashboard"
        description="The analytics summary endpoint did not respond. The backend may be unreachable or your session may have expired."
        action={
          <button
            type="button"
            onClick={() => {
              void refetchStats();
            }}
            className="rounded-full bg-[#1d1d1b] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2d2d2b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b] focus-visible:ring-offset-2"
          >
            Retry
          </button>
        }
      />
    );
  }

  const aiTone =
    stats.ai_accuracy_pct >= 90
      ? 'text-emerald-600'
      : stats.ai_accuracy_pct >= 75
        ? 'text-amber-600'
        : 'text-red-600';

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#1d1d1b]">Dashboard</h1>
          <p className="mt-0.5 text-sm text-[#6f6e69]">Live report review workload</p>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#6f6e69] shadow-sm ring-1 ring-black/5 sm:inline-flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Auto-refresh 30 s
        </span>
      </div>

      {/* Queue stats */}
      <section aria-label="Pending review counts">
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
          Pending review
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label={staffReportStatusLabel('pending_moderator')}
            value={stats.pending_moderator}
            icon={IconClock}
          />
          <StatCard label="Duplicates" value={stats.duplicates_pending} icon={IconLink} />
          <StatCard label="Misrepresentation" value={stats.fraud_pending} icon={IconFingerprint} />
          <StatCard
            label="Avg review"
            value={`${stats.avg_review_minutes} min`}
            hint="Last 24 h"
            icon={IconTrendingUp}
          />
        </div>
      </section>

      {/* Today's outcomes */}
      <section aria-label="Today's outcomes">
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
          Today&apos;s outcomes
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Approved" value={stats.approved_today} icon={IconCheck} />
          <StatCard
            label={staffReportStatusLabel('rejected')}
            value={stats.rejected_today}
            icon={IconCheck}
          />
          <StatCard
            label={staffReportStatusLabel('merged')}
            value={stats.merged_today}
            icon={IconCheck}
          />
          <StatCard
            label={staffReportStatusLabel('escalated')}
            value={stats.escalated_today}
            icon={IconCheck}
          />
        </div>
      </section>

      {/* AI accuracy */}
      <section>
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
          AI accuracy
        </h2>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#6f6e69]">7-day agreement rate</span>
            <span className={`text-lg font-semibold tabular-nums ${aiTone}`}>
              {stats.ai_accuracy_pct.toFixed(1)}%
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#85847f]">
            Fraction of moderator decisions that agreed with the AI recommendation over the last 7
            days. Lower scores indicate that the AI provider needs prompt tuning or a swap to a
            stronger model.
          </p>
        </div>
      </section>

      {/* Recent reports + Review CTA */}
      <section aria-label="Reports awaiting review">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
            Awaiting review
          </h2>
          <button
            type="button"
            onClick={() => {
              void navigate('/moderator/queue');
            }}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-white px-4 text-xs font-medium text-[#1d1d1b] ring-1 ring-[#d8d6cf] transition-colors hover:text-[#6f6e69]"
          >
            View all
            <IconArrowRight className="h-3.5 w-3.5" stroke={1.6} />
          </button>
        </div>

        <div className="mt-3 overflow-hidden rounded-xl bg-white p-2 shadow-sm ring-1 ring-black/5">
          {recentQueue && recentQueue.length > 0 ? (
            <ul className="divide-y divide-[#e4e2dc]">
              {recentQueue.map((item) => (
                <li key={item.id}>
                  <QueueRow
                    item={item}
                    onSelect={(id) => {
                      void navigate(`/moderator/reports/${id}`);
                    }}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-6 text-center">
              <p className="text-sm text-[#6f6e69]">No reports are awaiting review</p>
            </div>
          )}
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              void navigate('/moderator/queue');
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1d1d1b] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#2d2d2b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b] focus-visible:ring-offset-2 sm:w-auto"
          >
            <IconEye className="h-4 w-4" stroke={1.6} />
            Review reports
          </button>
        </div>
      </section>
    </div>
  );
}
