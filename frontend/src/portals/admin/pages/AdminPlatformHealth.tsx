import { type JSX } from 'react';
import {
  usePlatformHealth,
  usePlatformHealthComponents,
  type HealthComponent,
} from '../api/client';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Spinner,
  EmptyState,
  ErrorState,
} from '../../moderator/design';
import { cx } from '../../moderator/design/cx';

const STATUS_COLOR: Record<string, string> = {
  ok: 'bg-[#edf7f0] text-[#256b45] ring-[#c8e6d2]',
  degraded: 'bg-[#fff6e4] text-[#805913] ring-[#f0d9a8]',
  down: 'bg-[#fbeeed] text-[#9f3731] ring-[#ecccc8]',
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
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ring-1 ring-inset',
        STATUS_COLOR[status] ?? 'bg-[#efeee9] text-[#6f6e69] ring-[#d0cec8]',
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

  if (summary.isError || components.isError) {
    return (
      <div className="min-h-screen bg-[#f3f2ed] p-4 sm:p-6">
        <ErrorState
          title="Failed to load platform health"
          description="The health probe could not be reached. Try again in a moment."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f2ed] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#1d1d1b]">
              Platform health
            </h1>
            <p className="mt-1 text-sm text-[#6f6e69]">
              Live probe of every critical platform component. Refreshes every 30s.
            </p>
          </div>
          {summary.isFetching ? <Spinner label="Refreshing" /> : null}
        </header>

        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                  Overall
                </p>
                <p
                  className={cx(
                    'mt-1 text-3xl font-semibold tracking-[-0.02em]',
                    overall === 'ok'
                      ? 'text-[#256b45]'
                      : overall === 'degraded'
                        ? 'text-[#805913]'
                        : overall === 'down'
                          ? 'text-[#9f3731]'
                          : 'text-[#1d1d1b]',
                  )}
                >
                  {overall.toUpperCase()}
                </p>
              </div>
              {checkedAt ? (
                <p className="text-xs text-[#85847f]">
                  last checked {new Date(checkedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Components</CardTitle>
          </CardHeader>
          {summary.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner label="Probing components" />
            </div>
          ) : rows === null || Object.keys(rows).length === 0 ? (
            <div className="px-5 py-10">
              <EmptyState
                title="No component data"
                description="No component probes reported yet."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[#e4e2dc] bg-[#f3f2ed]">
                    <th
                      scope="col"
                      className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]"
                    >
                      Component
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]"
                    >
                      Latency
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]"
                    >
                      Detail
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e4e2dc]">
                  {Object.entries(rows).map(([key, comp]) => (
                    <tr key={key}>
                      <td className="px-5 py-3 text-sm font-medium text-[#1d1d1b]">
                        {COMPONENT_LABEL[key] ?? key}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <StatusPill status={comp.status} />
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums text-[#6f6e69]">
                        {comp.latency_ms} ms
                      </td>
                      <td className="px-5 py-3 text-sm text-[#6f6e69]">
                        <div>{comp.detail}</div>
                        {comp.driver ? (
                          <div className="text-xs text-[#85847f]">driver: {comp.driver}</div>
                        ) : null}
                        {comp.disk ? (
                          <div className="text-xs text-[#85847f]">disk: {comp.disk}</div>
                        ) : null}
                        {typeof comp.count === 'number' ? (
                          <div className="text-xs text-[#85847f]">count: {comp.count}</div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
