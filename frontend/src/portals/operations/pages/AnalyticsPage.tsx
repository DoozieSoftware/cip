import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { Card, CardBody, CardHeader, CardTitle, Spinner, EmptyState } from '../design';
import { departmentApi } from '../api/operations';
import type { DepartmentDashboardCounts, DepartmentReportListItem } from '../types';

interface SeriesDatum {
  name: string;
  value: number;
}

export default function AnalyticsPage() {
  const dashboard = useQuery<DepartmentDashboardCounts>({
    queryKey: ['operations', 'dashboard', 'analytics'],
    queryFn: async () => (await departmentApi.dashboard()).data,
  });

  // Pull a page of recent reports to compute by-status
  // and by-type breakdowns for the analytics widgets.
  const recent = useQuery<{ data: DepartmentReportListItem[] }>({
    queryKey: ['operations', 'analytics', 'recent'],
    queryFn: () =>
      departmentApi
        .listReports({ per_page: 500 })
        .then((p) => ({ data: (p as { data: DepartmentReportListItem[] }).data })),
  });

  const isLoading = dashboard.isLoading || recent.isLoading;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20" aria-live="polite">
        <Spinner label="Loading analytics" />
      </div>
    );
  }
  if (dashboard.error || recent.error) {
    return (
      <EmptyState
        title="Could not load analytics"
        description="The dashboard or reports endpoint did not respond."
      />
    );
  }

  const counts = dashboard.data ?? { open: 0, due_today: 0, sla_breached: 0, by_category: {} };
  const reports = recent.data?.data ?? [];

  // By-status pie
  const byStatus: SeriesDatum[] = Object.entries(
    reports.reduce<Record<string, number>>((acc, r) => {
      const code = r.current_status_code ?? 'unknown';
      acc[code] = (acc[code] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  // By-type bar
  const byType: SeriesDatum[] = Object.entries(
    reports.reduce<Record<string, number>>((acc, r) => {
      const code = r.report_type?.code ?? 'uncategorized';
      acc[code] = (acc[code] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  // Daily submissions line
  const byDay: Record<string, number> = reports.reduce<Record<string, number>>((acc, r) => {
    const day = r.submitted_at ? r.submitted_at.slice(0, 10) : null;
    if (!day) return acc;
    acc[day] = (acc[day] ?? 0) + 1;
    return acc;
  }, {});
  const dayKeys = Object.keys(byDay).sort();
  const daySeries = dayKeys.map((k) => [k, byDay[k]]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500">Live operational load for the officer's department</p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Open reports</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-semibold text-slate-900">{counts.open}</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Due today</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-semibold text-slate-900">{counts.due_today}</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>SLA breached</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-semibold text-red-600">{counts.sla_breached}</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By status</CardTitle>
          </CardHeader>
          <CardBody>
            <ReactECharts
              option={{
                tooltip: { trigger: 'item' },
                legend: { bottom: 0 },
                series: [
                  {
                    type: 'pie',
                    radius: ['40%', '70%'],
                    data: byStatus,
                  },
                ],
              }}
              style={{ height: 320 }}
              aria-label="Open reports by status"
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By report type</CardTitle>
          </CardHeader>
          <CardBody>
            <ReactECharts
              option={{
                tooltip: { trigger: 'axis' },
                xAxis: { type: 'category', data: byType.map((d) => d.name) },
                yAxis: { type: 'value' },
                series: [{ type: 'bar', data: byType.map((d) => d.value) }],
              }}
              style={{ height: 320 }}
              aria-label="Open reports by report type"
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submissions per day</CardTitle>
        </CardHeader>
        <CardBody>
          <ReactECharts
            option={{
              tooltip: { trigger: 'axis' },
              xAxis: { type: 'category', data: dayKeys },
              yAxis: { type: 'value' },
              series: [{ type: 'line', data: daySeries.map((d) => d[1]), smooth: true, areaStyle: {} }],
            }}
            style={{ height: 320 }}
            aria-label="Reports submitted per day"
          />
        </CardBody>
      </Card>
    </div>
  );
}
