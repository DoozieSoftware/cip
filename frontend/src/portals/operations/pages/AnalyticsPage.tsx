import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import {
  IconChartBar,
  IconChartPie,
  IconChartLine,
  IconClock,
  IconAlertTriangle,
  IconChecklist,
} from '@tabler/icons-react';
import { Spinner } from '../../../shared/ui';
import { departmentApi } from '../api/operations';
import { useDepartmentSelection } from '../context/DepartmentSelectionContext';
import type { DepartmentDashboardCounts, DepartmentReportListItem } from '../types';

interface SeriesDatum {
  name: string;
  value: number;
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string; stroke?: number }>;
  tone?: 'default' | 'danger' | 'warning';
}) {
  const tones = {
    default: 'bg-[var(--color-canvas)] text-[var(--color-ink)]',
    danger: 'bg-red-50 text-red-700',
    warning: 'bg-amber-50 text-amber-700',
  };
  const valueColors = {
    default: 'text-[var(--color-ink)]',
    danger: 'text-red-700',
    warning: 'text-amber-700',
  };

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
          {label}
        </span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-4 w-4" stroke={1.6} />
        </div>
      </div>
      <p className={`mt-3 text-3xl font-semibold ${valueColors[tone]}`}>{value}</p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string; stroke?: number }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-canvas)]">
          <Icon className="h-4 w-4 text-[var(--color-text-secondary)]" stroke={1.6} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">{title}</h3>
          {subtitle && <p className="text-[11px] text-[var(--color-text-tertiary)]">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function AnalyticsPage() {
  const { selectedId, ready, memberships } = useDepartmentSelection();
  const dashboard = useQuery<DepartmentDashboardCounts>({
    queryKey: ['operations', 'dashboard', 'analytics', selectedId],
    queryFn: () => departmentApi.dashboard({ department_id: selectedId ?? undefined }),
    enabled: ready && memberships.length > 0,
  });

  const recent = useQuery<{ data: DepartmentReportListItem[] }>({
    queryKey: ['operations', 'analytics', 'recent', selectedId],
    queryFn: () =>
      departmentApi
        .listReports({ per_page: 500, department_id: selectedId ?? undefined })
        .then((p) => ({ data: (p as { data: DepartmentReportListItem[] }).data })),
    enabled: ready && memberships.length > 0,
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
      <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-black/5">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <IconAlertTriangle className="h-6 w-6 text-red-500" stroke={1.6} />
        </div>
        <h3 className="text-base font-semibold text-[var(--color-ink)]">
          Could not load analytics
        </h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          The dashboard or reports endpoint did not respond.
        </p>
      </div>
    );
  }

  const counts = dashboard.data ?? { open: 0, due_today: 0, sla_breached: 0, by_category: {} };
  const reports = recent.data?.data ?? [];

  const byStatus: SeriesDatum[] = Object.entries(
    reports.reduce<Record<string, number>>((acc, r) => {
      const code = r.current_status_code ?? 'unknown';
      acc[code] = (acc[code] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  const byType: SeriesDatum[] = Object.entries(
    reports.reduce<Record<string, number>>((acc, r) => {
      const code = r.report_type?.code ?? 'uncategorized';
      acc[code] = (acc[code] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  const byDay: Record<string, number> = reports.reduce<Record<string, number>>((acc, r) => {
    const day = r.submitted_at ? r.submitted_at.slice(0, 10) : null;
    if (!day) return acc;
    acc[day] = (acc[day] ?? 0) + 1;
    return acc;
  }, {});
  const dayKeys = Object.keys(byDay).sort();
  const daySeries = dayKeys.map((k) => [k, byDay[k]]);

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-ink)]">
          <IconChartBar className="h-5 w-5 text-white" stroke={1.6} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-[var(--color-ink)]">Analytics</h1>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Live operational load for the officer's department
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Open reports" value={counts.open} icon={IconChecklist} />
        <StatCard label="Due today" value={counts.due_today} icon={IconClock} tone="warning" />
        <StatCard
          label="Overdue reports"
          value={counts.sla_breached}
          icon={IconAlertTriangle}
          tone="danger"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="By status"
          subtitle="Distribution across workflow states"
          icon={IconChartPie}
        >
          <ReactECharts
            option={{
              tooltip: { trigger: 'item' },
              legend: { bottom: 0, textStyle: { color: '#6f6e69', fontSize: 11 } },
              series: [
                {
                  type: 'pie',
                  radius: ['40%', '70%'],
                  data: byStatus,
                  label: { color: '#1d1d1b', fontSize: 11 },
                  itemStyle: { borderColor: '#fff', borderWidth: 2 },
                },
              ],
            }}
            style={{ height: 320 }}
            aria-label="Open reports by status"
          />
        </ChartCard>
        <ChartCard title="By report type" subtitle="Category breakdown" icon={IconChartBar}>
          <ReactECharts
            option={{
              tooltip: { trigger: 'axis' },
              grid: { left: 50, right: 16, top: 16, bottom: 24 },
              xAxis: {
                type: 'category',
                data: byType.map((d) => d.name),
                axisLabel: { color: '#6f6e69', fontSize: 10 },
                axisLine: { lineStyle: { color: '#e5e5e0' } },
              },
              yAxis: {
                type: 'value',
                axisLabel: { color: '#85847f', fontSize: 10 },
                splitLine: { lineStyle: { color: '#f3f2ed' } },
              },
              series: [
                {
                  type: 'bar',
                  data: byType.map((d) => d.value),
                  itemStyle: { borderRadius: [4, 4, 0, 0], color: '#1d1d1b' },
                },
              ],
            }}
            style={{ height: 320 }}
            aria-label="Open reports by report type"
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Submissions per day"
        subtitle="Trend over the selected period"
        icon={IconChartLine}
      >
        <ReactECharts
          option={{
            tooltip: { trigger: 'axis' },
            grid: { left: 50, right: 16, top: 16, bottom: 24 },
            xAxis: {
              type: 'category',
              data: dayKeys,
              axisLabel: { color: '#6f6e69', fontSize: 10 },
              axisLine: { lineStyle: { color: '#e5e5e0' } },
            },
            yAxis: {
              type: 'value',
              axisLabel: { color: '#85847f', fontSize: 10 },
              splitLine: { lineStyle: { color: '#f3f2ed' } },
            },
            series: [
              {
                type: 'line',
                data: daySeries.map((d) => d[1]),
                smooth: true,
                lineStyle: { color: '#1d1d1b', width: 2 },
                areaStyle: { color: 'rgba(29,29,27,0.06)' },
                itemStyle: { color: '#1d1d1b' },
              },
            ],
          }}
          style={{ height: 320 }}
          aria-label="Reports submitted per day"
        />
      </ChartCard>
    </div>
  );
}
