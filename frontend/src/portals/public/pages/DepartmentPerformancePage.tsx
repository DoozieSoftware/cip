import { type JSX } from 'react';
import { usePublicDepartmentPerformance } from '../api/client';
import { Spinner, EmptyState, Table, THead, TBody, TR, TH, TD } from '../../moderator/design';

function formatHours(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 24) return `${hours}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export default function DepartmentPerformancePage(): JSX.Element {
  const performance = usePublicDepartmentPerformance();
  const departments = performance.data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Department performance</h1>
        <p className="mt-1 text-sm text-slate-600">
          Resolution rate and median resolution time per department — aggregate counts only.
        </p>
      </header>

      {performance.isLoading ? (
        <div className="flex items-center justify-center py-16"><Spinner label="Loading department performance" /></div>
      ) : performance.isError ? (
        <EmptyState title="Department performance unavailable" description="Please try again shortly." />
      ) : departments.length === 0 ? (
        <EmptyState title="No department data yet" description="Performance figures will appear once departments start resolving reports." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <Table>
            <THead>
              <TR>
                <TH>Department</TH>
                <TH>Reports</TH>
                <TH>Resolved</TH>
                <TH>Resolution rate</TH>
                <TH>Median resolution time</TH>
              </TR>
            </THead>
            <TBody>
              {departments.map((d) => (
                <TR key={d.id}>
                  <TD>
                    <div className="font-medium text-slate-900">{d.name}</div>
                    <div className="font-mono text-xs text-slate-500">{d.code}</div>
                  </TD>
                  <TD>{d.total_reports}</TD>
                  <TD>{d.resolved_reports}</TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(100, d.resolution_rate_percent)}%` }}
                        />
                      </div>
                      <span className="text-sm text-slate-700">{d.resolution_rate_percent}%</span>
                    </div>
                  </TD>
                  <TD>{formatHours(d.median_resolution_hours)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
