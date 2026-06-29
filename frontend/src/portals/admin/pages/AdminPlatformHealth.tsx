import { type JSX } from 'react';
import { usePlatformHealth, usePlatformHealthComponents, type HealthComponent } from '../api/client';
import { Spinner } from '../../moderator/design';
import { cx } from '../../moderator/design/cx';

const STATUS_COLOR: Record<string, string> = {
  ok: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  degraded: 'bg-amber-100 text-amber-800 border-amber-200',
  down: 'bg-rose-100 text-rose-800 border-rose-200',
};

const COMPONENT_LABEL: Record<string, string> = {
  database: 'Database',
  redis: 'Redis cache',
  queue: 'Job queue',
  ai: 'AI providers',
  storage: 'Object storage',
  scheduler: 'Scheduler',
};

function StatusPill({ status }: { status: HealthComponent['status'] }): JSX.Element {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide',
        STATUS_COLOR[status] ?? 'bg-slate-100 text-slate-700 border-slate-200',
      )}
    >
      <span aria-hidden>{status === 'ok' ? '✓' : status === 'degraded' ? '!' : '✗'}</span>
      {status}
    </span>
  );
}

export default function AdminPlatformHealth(): JSX.Element {
  const summary = usePlatformHealth();
  const components = usePlatformHealthComponents();

  const overall = summary.data?.status ?? '—';
  const rows = components.data?.components ?? summary.data?.components ?? null;
  const checkedAt = components.data?.checked_at ?? summary.data?.checked_at ?? null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform health</h1>
          <p className="mt-1 text-sm text-slate-600">
            Live probe of every critical platform component. Refreshes every 30s.
          </p>
        </div>
        {summary.isFetching ? <Spinner label="Refreshing" /> : null}
      </header>

      <section
        aria-label="Overall status"
        className={cx(
          'rounded-xl border p-5',
          overall === 'ok'
            ? 'border-emerald-200 bg-emerald-50'
            : overall === 'degraded'
              ? 'border-amber-200 bg-amber-50'
              : 'border-rose-200 bg-rose-50',
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overall</div>
            <div className="mt-1 text-3xl font-bold text-slate-900">{overall.toUpperCase()}</div>
          </div>
          {checkedAt ? (
            <div className="text-xs text-slate-500">last checked {new Date(checkedAt).toLocaleString()}</div>
          ) : null}
        </div>
      </section>

      <section aria-label="Components" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {summary.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner label="Probing components" />
          </div>
        ) : rows === null || Object.keys(rows).length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No component data yet.</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Component
                </th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Latency
                </th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {Object.entries(rows).map(([key, comp]) => (
                <tr key={key}>
                  <td className="px-5 py-3 text-sm font-medium text-slate-900">{COMPONENT_LABEL[key] ?? key}</td>
                  <td className="px-5 py-3 text-sm">
                    <StatusPill status={comp.status} />
                  </td>
                  <td className="px-5 py-3 text-sm tabular-nums text-slate-700">{comp.latency_ms} ms</td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    <div>{comp.detail}</div>
                    {comp.driver ? <div className="text-xs text-slate-400">driver: {comp.driver}</div> : null}
                    {comp.disk ? <div className="text-xs text-slate-400">disk: {comp.disk}</div> : null}
                    {typeof comp.count === 'number' ? (
                      <div className="text-xs text-slate-400">count: {comp.count}</div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
