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
} from '../../../shared/ui';
import { cx } from '../../../shared/ui/cx';

const STATUS_COLOR: Record<string, string> = {
  ok: 'bg-[#edf7f0] text-[var(--color-success)] ring-[#c8e6d2]',
  degraded: 'bg-[#fff6e4] text-[#805913] ring-[#f0d9a8]',
  down: 'bg-[#fbeeed] text-[var(--color-danger)] ring-[#ecccc8]',
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
        STATUS_COLOR[status] ??
          'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] ring-[var(--color-border)]',
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
      <div>
        <ErrorState
          title="Failed to load platform health"
          description="The health probe could not be reached. Try again in a moment."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
            Platform health
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Live probe of every critical platform component. Refreshes every 30s.
          </p>
        </div>
        {summary.isFetching ? <Spinner label="Refreshing" /> : null}
      </header>

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                Overall
              </p>
              <p
                className={cx(
                  'mt-1 text-3xl font-semibold tracking-[-0.02em]',
                  overall === 'ok'
                    ? 'text-[var(--color-success)]'
                    : overall === 'degraded'
                      ? 'text-[#805913]'
                      : overall === 'down'
                        ? 'text-[var(--color-danger)]'
                        : 'text-[var(--color-ink)]',
                )}
              >
                {overall.toUpperCase()}
              </p>
            </div>
            {checkedAt ? (
              <p className="text-xs text-[var(--color-text-tertiary)]">
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
            <EmptyState title="No component data" description="No component probes reported yet." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem]">
              <thead>
                <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-canvas)]">
                  <th
                    scope="col"
                    className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]"
                  >
                    Component
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]"
                  >
                    Latency
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]"
                  >
                    Detail
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {Object.entries(rows).map(([key, comp]) => (
                  <tr key={key}>
                    <td className="px-5 py-3 text-sm font-medium text-[var(--color-ink)]">
                      {COMPONENT_LABEL[key] ?? key}
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <StatusPill status={comp.status} />
                    </td>
                    <td className="px-5 py-3 text-sm tabular-nums text-[var(--color-text-secondary)]">
                      {comp.latency_ms} ms
                    </td>
                    <td className="px-5 py-3 text-sm text-[var(--color-text-secondary)]">
                      <div>{comp.detail}</div>
                      {comp.driver ? (
                        <div className="text-xs text-[var(--color-text-tertiary)]">
                          driver: {comp.driver}
                        </div>
                      ) : null}
                      {comp.disk ? (
                        <div className="text-xs text-[var(--color-text-tertiary)]">
                          disk: {comp.disk}
                        </div>
                      ) : null}
                      {typeof comp.count === 'number' ? (
                        <div className="text-xs text-[var(--color-text-tertiary)]">
                          count: {comp.count}
                        </div>
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
  );
}
