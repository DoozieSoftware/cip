import { type JSX } from 'react';
import { useSchedulerJobs, useSchedulerAction, type SchedulerJob } from '../api/client';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Button,
  Spinner,
  EmptyState,
  ErrorState,
} from '../../../shared/ui';
import { IconPlayerPlay, IconPlayerPause, IconPlayerSkipForward } from '@tabler/icons-react';

function StatusPill({ paused }: { paused: boolean }): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ring-1 ring-inset ${
        paused
          ? 'bg-[#fbeeed] text-[var(--color-danger)] ring-[#ecccc8]'
          : 'bg-[#edf7f0] text-[var(--color-success)] ring-[#c8e6d2]'
      }`}
    >
      <span aria-hidden>{paused ? '⏸' : '▶'}</span>
      {paused ? 'paused' : 'running'}
    </span>
  );
}

function JobRow({
  job,
  busy,
  onAction,
}: {
  job: SchedulerJob;
  busy: boolean;
  onAction: (a: 'run-now' | 'pause' | 'resume') => void;
}): JSX.Element {
  return (
    <tr>
      <td className="px-5 py-3">
        <div className="text-sm font-medium text-[var(--color-ink)]">{job.id}</div>
        {job.command ? (
          <div className="font-mono text-xs text-[var(--color-text-tertiary)]">{job.command}</div>
        ) : null}
      </td>
      <td className="px-5 py-3 text-sm text-[var(--color-text-secondary)]">
        <code className="rounded bg-[var(--color-surface-alt)] px-1.5 py-0.5 text-xs">
          {job.expression || '—'}
        </code>
      </td>
      <td className="px-5 py-3 text-sm tabular-nums text-[var(--color-text-secondary)]">
        {job.next_due_at ? new Date(job.next_due_at).toLocaleString() : '—'}
      </td>
      <td className="px-5 py-3 text-sm">
        <StatusPill paused={job.paused} />
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => onAction('run-now')}
            leftIcon={<IconPlayerSkipForward className="h-3.5 w-3.5" stroke={1.6} />}
          >
            Run now
          </Button>
          {job.paused ? (
            <Button
              variant="success"
              size="sm"
              disabled={busy}
              onClick={() => onAction('resume')}
              leftIcon={<IconPlayerPlay className="h-3.5 w-3.5" stroke={1.6} />}
            >
              Resume
            </Button>
          ) : (
            <Button
              variant="danger"
              size="sm"
              disabled={busy}
              onClick={() => onAction('pause')}
              leftIcon={<IconPlayerPause className="h-3.5 w-3.5" stroke={1.6} />}
            >
              Pause
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AdminScheduler(): JSX.Element {
  const jobs = useSchedulerJobs();
  const action = useSchedulerAction();

  const list = jobs.data ?? [];
  const running = list.filter((j) => !j.paused).length;
  const paused = list.filter((j) => j.paused).length;

  const handleAction = (id: string, a: 'run-now' | 'pause' | 'resume'): void => {
    action.mutate({ id, action: a });
  };

  if (jobs.isError) {
    return (
      <div>
        <ErrorState
          title="Failed to load scheduler"
          description="The scheduler jobs could not be loaded. Try again in a moment."
          error={jobs.error instanceof Error ? jobs.error : null}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
            Scheduler
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Every registered queue + scheduled job. Pause, resume, or run them on demand.
          </p>
        </div>
        {jobs.isFetching ? <Spinner label="Refreshing" /> : null}
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              Total jobs
            </p>
            <p className="mt-1 text-2xl font-semibold text-[var(--color-ink)]">{list.length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-success)]">
              Running
            </p>
            <p className="mt-1 text-2xl font-semibold text-[var(--color-success)]">{running}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-danger)]">
              Paused
            </p>
            <p className="mt-1 text-2xl font-semibold text-[var(--color-danger)]">{paused}</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled jobs</CardTitle>
        </CardHeader>
        {jobs.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner label="Loading jobs" />
          </div>
        ) : list.length === 0 ? (
          <div className="px-5 py-10">
            <EmptyState title="No scheduled jobs" description="No scheduled jobs are registered." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem]">
              <thead>
                <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-canvas)]">
                  <th
                    scope="col"
                    className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]"
                  >
                    Job
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]"
                  >
                    Schedule
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]"
                  >
                    Next run
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {list.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    busy={action.isPending}
                    onAction={(a) => handleAction(job.id, a)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {action.isError ? (
        <div
          role="alert"
          className="rounded-xl border border-[#ecccc8] bg-[#fbeeed] px-4 py-3 text-sm text-[var(--color-danger)]"
        >
          Action failed: {action.error?.message ?? 'unknown error'}
        </div>
      ) : null}
    </div>
  );
}
