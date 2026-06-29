import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Spinner,
} from '../design';
import { analyticsApi } from '../api/moderator';
import type { AnalyticsSummary } from '../types';
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);

function OutcomesChart({ data }: { data: AnalyticsSummary }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption({
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [
        {
          name: 'Today',
          type: 'pie',
          radius: ['45%', '70%'],
          data: [
            { name: 'Approved', value: data.approved_today },
            { name: 'Rejected', value: data.rejected_today },
            { name: 'Merged', value: data.merged_today },
            { name: 'Escalated', value: data.escalated_today },
          ],
        },
      ],
    });
    return () => chart.dispose();
  }, [data]);
  return <div ref={ref} className="h-72 w-full" role="img" aria-label="Outcomes today (pie chart)" />;
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
    return <EmptyState title="Could not load analytics" description="The /moderator/analytics/summary endpoint did not respond." />;
  }

  const a = q.data;
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Moderator analytics</h1>
        <p className="text-sm text-slate-500">Throughput, queue health, and AI agreement for the last 24 h.</p>
      </header>

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
            <CardTitle>Queue health</CardTitle>
            <Badge tone={a.pending_moderator > 50 ? 'warning' : 'success'}>
              {a.pending_moderator} pending
            </Badge>
          </CardHeader>
          <CardBody className="space-y-2 text-sm text-slate-700">
            <p>Pending moderator: <strong>{a.pending_moderator}</strong></p>
            <p>Duplicate candidates: <strong>{a.duplicates_pending}</strong></p>
            <p>Fraud suspects: <strong>{a.fraud_pending}</strong></p>
            <p>Average review time: <strong>{a.avg_review_minutes} min</strong></p>
            <p>AI accuracy (7d): <strong>{a.ai_accuracy_pct.toFixed(1)}%</strong></p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
