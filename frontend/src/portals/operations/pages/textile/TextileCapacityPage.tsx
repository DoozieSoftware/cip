import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type JSX } from 'react';
import {
  fetchCapacityRules,
  decideCapacityException,
  fetchCapacityExceptions,
  fetchTextileReportingDashboard,
  textileReportingExportUrl,
} from '../../api/textileApi';
import { DeskPage, DeskStates, useDesk } from './shared';

export default function TextileCapacityPage(): JSX.Element {
  const desk = useDesk();
  const queryClient = useQueryClient();
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
  const exceptions = useQuery({
    queryKey: ['textile', 'capacity-exceptions', desk.departmentId],
    queryFn: () => fetchCapacityExceptions({ department_id: desk.departmentId, status: 'pending' }),
    enabled: desk.ready && desk.isDrLinen,
  });
  const decideException = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
      decideCapacityException(
        id,
        decision,
        `Partner ${decision}d this capacity exception after review.`,
        desk.departmentId,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['textile', 'capacity-exceptions'] }),
  });
  const report = dashboard.data;

  return (
    <DeskPage
      desk={desk}
      title="Capacity and performance"
      description="Partner-owned capacity policy, explainable route limits, and collection performance. Staff must approve exceptions before a policy is overridden."
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
              label="Exception rate"
              value={`${report.rates.exception_rate_pct}%`}
              note={`${report.rates.exception_approved} approved`}
            />
          </section>
        ) : null}

        {report ? (
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
            Data quality: {report.data_quality.note}{' '}
            {report.data_quality.missing_estimates > 0
              ? `${report.data_quality.missing_estimates} request(s) are missing estimates.`
              : ''}
          </p>
        ) : null}

        <section className="rounded-xl border border-black/10 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Zone capacity rules</h2>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Limits warn staff before schedule confirmation. Below-minimum requests need a
                documented exception, not an automatic rejection.
              </p>
            </div>
            {report ? (
              <a
                href={textileReportingExportUrl({ department_id: desk.departmentId })}
                className="rounded-full border border-black/15 px-3 py-2 text-xs font-medium"
              >
                Export CSV
              </a>
            ) : null}
          </div>
          {rules.data && rules.data.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-black/10 text-[var(--color-text-secondary)]">
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
                    <tr key={rule.id} className="border-b border-black/5">
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

        <section className="rounded-xl border border-black/10 bg-white p-4">
          <h2 className="text-sm font-semibold">Pending capacity exceptions</h2>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            A human decision and audit reason are required before a capacity policy is overridden.
          </p>
          {exceptions.isLoading ? <p className="mt-3 text-sm">Loading exceptions…</p> : null}
          {exceptions.isError ? (
            <p role="alert" className="mt-3 text-sm text-red-700">
              Could not load capacity exceptions.
            </p>
          ) : null}
          {exceptions.data?.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
              No pending exceptions.
            </p>
          ) : null}
          {exceptions.data?.length ? (
            <ul className="mt-3 space-y-2">
              {exceptions.data.map((exception) => (
                <li
                  key={exception.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 p-3 text-xs"
                >
                  <div>
                    <p className="font-medium">
                      {exception.collection?.reference ?? exception.collection_request_id} ·{' '}
                      {exception.reason_code?.replaceAll('_', ' ') ?? 'Capacity exception'}
                    </p>
                    <p className="mt-1 text-[var(--color-text-secondary)]">{exception.reason}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={decideException.isPending}
                      onClick={() =>
                        decideException.mutate({ id: exception.id, decision: 'approve' })
                      }
                      className="rounded-full bg-emerald-700 px-3 py-1.5 text-white disabled:opacity-40"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={decideException.isPending}
                      onClick={() =>
                        decideException.mutate({ id: exception.id, decision: 'reject' })
                      }
                      className="rounded-full border border-rose-300 px-3 py-1.5 text-rose-700 disabled:opacity-40"
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {report ? (
          <section className="rounded-xl border border-black/10 bg-white p-4">
            <h2 className="text-sm font-semibold">Metric definitions</h2>
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              {Object.entries(report.definitions).map(([name, definition]) => (
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
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">{note}</p>
    </div>
  );
}
