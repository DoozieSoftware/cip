import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type JSX } from 'react';
import {
  downloadTextileReportingExport,
  fetchCapacityRules,
  fetchTextileReportingDashboard,
} from '../../api/textileApi';
import { DeskPage, DeskStates, useDesk } from './shared';

export default function TextileCapacityPage(): JSX.Element {
  const desk = useDesk();
  const rules = useQuery({
    queryKey: ['textile', 'capacity-rules', desk.departmentId],
    queryFn: () => fetchCapacityRules(desk.departmentId),
    enabled: desk.ready && desk.isDrLinen,
  });
  const dashboard = useQuery({
    queryKey: ['textile', 'reporting', desk.departmentId],
    queryFn: () => fetchTextileReportingDashboard({ department_id: desk.departmentId }),
    enabled: desk.ready && desk.isDrLinen,
  });
  const report = dashboard.data;
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport(): Promise<void> {
    setExportBusy(true);
    setExportError(null);
    try {
      await downloadTextileReportingExport({ department_id: desk.departmentId });
    } catch {
      setExportError('Export failed. Check your session and try again.');
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <DeskPage
      desk={desk}
      title="Capacity and performance"
      description="Partner-owned pickup eligibility, explainable route limits, and collection performance."
    >
      <DeskStates
        loading={rules.isLoading || dashboard.isLoading}
        error={rules.isError || dashboard.isError}
        onRetry={() => {
          void rules.refetch();
          void dashboard.refetch();
        }}
        hasRows={true}
        emptyTitle="No capacity data"
        emptyBody="Capacity policy and reporting will appear here."
      >
        {report ? (
          <section
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            aria-label="Collection performance summary"
          >
            <Metric
              label="Requests"
              value={report.totals.requests}
              note={`${report.period.start} to ${report.period.end}`}
            />
            <Metric
              label="Collected bags"
              value={report.totals.actual_bags}
              note={`Estimate ${report.totals.estimated_bags}`}
            />
            <Metric
              label="Missed rate"
              value={`${report.rates.missed_rate_pct}%`}
              note={`${report.rates.missed_count} missed`}
            />
            <Metric
              label="Reschedule rate"
              value={`${report.rates.reschedule_rate_pct}%`}
              note={`${report.rates.rescheduled_count} rescheduled`}
            />
          </section>
        ) : null}

        {report ? (
          <p className="rounded-lg border border-[var(--color-info)]/20 bg-[var(--color-info)]/[0.06] px-3 py-2 text-xs text-[var(--color-ink)]">
            Data quality: {report.data_quality.note}{' '}
            {report.data_quality.missing_estimates > 0
              ? `${report.data_quality.missing_estimates} request(s) are missing estimates.`
              : ''}
          </p>
        ) : null}

        <section className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Zone capacity rules
              </h2>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Home pickups below the configured minimum cannot be submitted or scheduled. Drop-off
                accepts any amount.
              </p>
            </div>
            {report ? (
              <div className="flex flex-col items-end gap-1">
                <button
                  type="button"
                  disabled={exportBusy}
                  onClick={() => void handleExport()}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ink)] disabled:opacity-40"
                >
                  {exportBusy ? 'Exporting…' : 'Export CSV'}
                </button>
                {exportError ? (
                  <p role="alert" className="text-xs text-[var(--color-danger)]">
                    {exportError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          {rules.data && rules.data.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-border-subtle)] text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    <th className="px-2 py-2">Zone</th>
                    <th>Max bags</th>
                    <th>Max kg</th>
                    <th>Max stops</th>
                    <th>Minimum</th>
                    <th>Guidance</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.data.map((rule) => (
                    <tr
                      key={rule.id}
                      className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-alt)]"
                    >
                      <td className="px-2 py-2 font-medium text-[var(--color-ink)]">
                        {rule.service_zone?.name ?? rule.service_zone_id}
                      </td>
                      <td>{rule.max_bags ?? 'No limit'}</td>
                      <td>{rule.max_weight_kg ?? 'No limit'}</td>
                      <td>{rule.max_stops ?? 'No limit'}</td>
                      <td>
                        {rule.min_bags ?? '—'} bags / {rule.min_weight_kg ?? '—'} kg
                      </td>
                      <td className="max-w-xs py-2 text-[var(--color-text-secondary)]">
                        {rule.guidance_text ?? 'No public guidance configured.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
              No capacity rules configured. Defaults apply until a partner creates a rule.
            </p>
          )}
        </section>

        {report ? (
          <section className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-4 sm:p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Metric definitions
            </h2>
            <dl className="mt-3 grid gap-2.5 text-xs sm:grid-cols-2">
              {Object.entries(report.definitions)
                .filter(([name]) => name !== 'exception_rate')
                .map(([name, definition]) => (
                  <div key={name} className="rounded-lg bg-[var(--color-surface-alt)] p-2.5">
                    <dt className="font-semibold capitalize text-[var(--color-ink)]">
                      {name.replaceAll('_', ' ')}
                    </dt>
                    <dd className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                      {definition}
                    </dd>
                  </div>
                ))}
            </dl>
          </section>
        ) : null}
      </DeskStates>
    </DeskPage>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note: string;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-3.5 sm:p-4 shadow-sm">
      <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tracking-tight text-[var(--color-ink)] tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">{note}</p>
    </div>
  );
}
