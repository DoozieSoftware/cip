import { useQuery } from '@tanstack/react-query';
import { type JSX } from 'react';
import {
  fetchCapacityRules,
  fetchTextileReportingDashboard,
  textileReportingExportUrl,
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

        <section className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Zone capacity rules</h2>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Home pickups below the configured minimum cannot be submitted or scheduled. Drop-off
                accepts any amount.
              </p>
            </div>
            {report ? (
              <a
                href={textileReportingExportUrl({ department_id: desk.departmentId })}
                className="inline-flex min-h-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-medium hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
              >
                Export CSV
              </a>
            ) : null}
          </div>
          {rules.data && rules.data.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
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
                    <tr key={rule.id} className="border-b border-[var(--color-border-subtle)]">
                      <td className="px-2 py-2 font-medium">
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
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
              No capacity rules configured. Defaults apply until a partner creates a rule.
            </p>
          )}
        </section>

        {report ? (
          <section className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-sm font-semibold">Metric definitions</h2>
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              {Object.entries(report.definitions)
                .filter(([name]) => name !== 'exception_rate')
                .map(([name, definition]) => (
                  <div key={name}>
                    <dt className="font-medium capitalize">{name.replaceAll('_', ' ')}</dt>
                    <dd className="text-[var(--color-text-secondary)]">{definition}</dd>
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
    <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-black/5">
      <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">{note}</p>
    </div>
  );
}
