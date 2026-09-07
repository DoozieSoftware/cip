import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Spinner,
} from '../../../shared/ui';
import { staffReportStatusLabel } from '../../../shared/statusDisplay';
import { analyticsApi } from '../api/moderator';
import type { AnalyticsSummary } from '../types';
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import {
  IconChartPie3,
  IconClockHour3,
  IconEyeCheck,
  IconUsers,
  IconArrowUpRight,
  IconArrowDownRight,
} from '@tabler/icons-react';

echarts.use([
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  CanvasRenderer,
]);

function OutcomesChart({ data }: { data: AnalyticsSummary }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption({
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { color: 'var(--color-text-secondary)' } },
      series: [
        {
          name: 'Today',
          type: 'pie',
          radius: ['45%', '70%'],
          label: {
            color: 'var(--color-ink)',
            // D9: show the raw count and share next to each slice, not
            // only on hover.
            formatter: (p: { name: string; value: number; percent: number }) =>
              `${p.name}: ${p.value} (${p.percent}%)`,
          },
          data: [
            {
              name: 'Approved',
              value: data.approved_today,
              // var(--color-success) #226b46 — token for success
              itemStyle: { color: '#226b46' },
            },
            {
              name: staffReportStatusLabel('rejected'),
              value: data.rejected_today,
              // var(--color-danger) #a42f29 — token for danger
              itemStyle: { color: '#a42f29' },
            },
            {
              name: staffReportStatusLabel('merged'),
              value: data.merged_today,
              // Badge purple (#7c3aed) — retained for merged duplicates, no direct --color- token
              itemStyle: { color: '#7c3aed' },
            },
            {
              name: staffReportStatusLabel('escalated'),
              value: data.escalated_today,
              // var(--color-warning) #b45309 — token for warning
              itemStyle: { color: '#b45309' },
            },
          ],
        },
      ],
    });
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [data]);
  return (
    <div ref={ref} className="h-72 w-full" role="img" aria-label="Outcomes today (pie chart)" />
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  trendUp,
}: {
  icon: typeof IconChartPie3;
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between">
        <div className="rounded-lg bg-[var(--color-canvas)] p-2">
          <Icon className="h-5 w-5 text-[var(--color-text-secondary)]" stroke={1.6} />
        </div>
        {trend && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-medium ${trendUp ? 'text-emerald-600' : 'text-red-500'}`}
          >
            {trendUp ? (
              <IconArrowUpRight className="h-3.5 w-3.5" stroke={1.6} />
            ) : (
              <IconArrowDownRight className="h-3.5 w-3.5" stroke={1.6} />
            )}
            {trend}
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-semibold text-[var(--color-ink)]">{value}</p>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
        {label}
      </p>
    </div>
  );
}

export default function AnalyticsPage() {
  const q = useQuery<AnalyticsSummary>({
    queryKey: ['moderator', 'analytics', 'summary'],
    queryFn: () => analyticsApi.summary(),
    refetchInterval: 60_000,
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center py-20" aria-live="polite">
        <Spinner label="Loading analytics" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <EmptyState
        title="Could not load analytics"
        description="The /moderator/analytics/summary endpoint did not respond."
      />
    );
  }

  const a = q.data;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-[var(--color-ink)]">Moderator analytics</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Throughput, review workload, and AI agreement for the last 24 h.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={IconClockHour3}
          label={staffReportStatusLabel('pending_moderator')}
          value={a.pending_moderator}
          trend="12%"
          trendUp={false}
        />
        <StatCard
          icon={IconUsers}
          label="Duplicates pending"
          value={a.duplicates_pending}
          trend="8%"
          trendUp={false}
        />
        <StatCard
          icon={IconEyeCheck}
          label="Misrepresentation alerts"
          value={a.fraud_pending}
          trend="3%"
          trendUp
        />
        <StatCard
          icon={IconChartPie3}
          label="Avg review time"
          value={`${a.avg_review_minutes} min`}
          trend="5%"
          trendUp
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Outcomes today</CardTitle>
            <Badge tone="info">live</Badge>
          </CardHeader>
          <CardBody>
            <OutcomesChart data={a} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Review workload</CardTitle>
            <Badge tone={a.pending_moderator > 50 ? 'warning' : 'success'}>
              {a.pending_moderator} need review
            </Badge>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
              <span className="text-sm text-[var(--color-text-secondary)]">
                {staffReportStatusLabel('pending_moderator')}
              </span>
              <span className="text-sm font-semibold text-[var(--color-ink)]">
                {a.pending_moderator}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
              <span className="text-sm text-[var(--color-text-secondary)]">
                Duplicate candidates
              </span>
              <span className="text-sm font-semibold text-[var(--color-ink)]">
                {a.duplicates_pending}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
              <span className="text-sm text-[var(--color-text-secondary)]">
                Misrepresentation alerts
              </span>
              <span className="text-sm font-semibold text-[var(--color-ink)]">
                {a.fraud_pending}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
              <span className="text-sm text-[var(--color-text-secondary)]">
                Average review time
              </span>
              <span className="text-sm font-semibold text-[var(--color-ink)]">
                {a.avg_review_minutes} min
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">AI accuracy (7d)</span>
              <span className="text-sm font-semibold text-[var(--color-ink)]">
                {a.ai_accuracy_pct.toFixed(1)}%
              </span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
