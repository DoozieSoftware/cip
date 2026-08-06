import { useQuery } from '@tanstack/react-query';
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, Spinner } from '../shared/ui';
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
      legend: { bottom: 0, textStyle: { color: '#6f6e69' } },
      series: [
        {
          name: 'Today',
          type: 'pie',
          radius: ['45%', '70%'],
          label: { color: '#1d1d1b' },
          data: [
            { name: 'Approved', value: data.approved_today, itemStyle: { color: '#16a34a' } },
            { name: 'Rejected', value: data.rejected_today, itemStyle: { color: '#dc2626' } },
            { name: 'Merged', value: data.merged_today, itemStyle: { color: '#7c3aed' } },
            { name: 'Escalated', value: data.escalated_today, itemStyle: { color: '#d97706' } },
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
    <div className="rounded-xl bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="rounded-lg bg-[#f3f2ed] p-2">
          <Icon className="h-5 w-5 text-[#6f6e69]" stroke={1.6} />
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
      <p className="mt-3 text-2xl font-semibold text-[#1d1d1b]">{value}</p>
      <p className="mt-0.5 text-sm text-[#6f6e69]">{label}</p>
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
        <h1 className="text-xl font-semibold text-[#1d1d1b]">Moderator analytics</h1>
        <p className="text-sm text-[#6f6e69]">
          Throughput, review workload, and AI agreement for the last 24 h.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={IconClockHour3}
          label="Pending moderator"
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
          label="Fraud suspects"
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
              {a.pending_moderator} pending
            </Badge>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#f3f2ed] pb-3">
              <span className="text-sm text-[#6f6e69]">Pending moderator</span>
              <span className="text-sm font-semibold text-[#1d1d1b]">{a.pending_moderator}</span>
            </div>
            <div className="flex items-center justify-between border-b border-[#f3f2ed] pb-3">
              <span className="text-sm text-[#6f6e69]">Duplicate candidates</span>
              <span className="text-sm font-semibold text-[#1d1d1b]">{a.duplicates_pending}</span>
            </div>
            <div className="flex items-center justify-between border-b border-[#f3f2ed] pb-3">
              <span className="text-sm text-[#6f6e69]">Fraud suspects</span>
              <span className="text-sm font-semibold text-[#1d1d1b]">{a.fraud_pending}</span>
            </div>
            <div className="flex items-center justify-between border-b border-[#f3f2ed] pb-3">
              <span className="text-sm text-[#6f6e69]">Average review time</span>
              <span className="text-sm font-semibold text-[#1d1d1b]">
                {a.avg_review_minutes} min
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#6f6e69]">AI accuracy (7d)</span>
              <span className="text-sm font-semibold text-[#1d1d1b]">
                {a.ai_accuracy_pct.toFixed(1)}%
              </span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
