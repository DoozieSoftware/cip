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
} from '../../moderator/design';
import { IconPlayerPlay, IconPlayerPause, IconPlayerSkipForward } from '@tabler/icons-react';

function StatusPill({ paused }: { paused: boolean }): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ring-1 ring-inset ${
        paused
          ? 'bg-[#fbeeed] text-[#9f3731] ring-[#ecccc8]'
          : 'bg-[#edf7f0] text-[#256b45] ring-[#c8e6d2]'
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
        <div className="text-sm font-medium text-[#1d1d1b]">{job.id}</div>
        {job.command ? <div className="font-mono text-xs text-[#85847f]">{job.command}</div> : null}
      </td>
      <td className="px-5 py-3 text-sm text-[#6f6e69]">
        <code className="rounded bg-[#efeee9] px-1.5 py-0.5 text-xs">{job.expression || '—'}</code>
      </td>
      <td className="px-5 py-3 text-sm tabular-nums text-[#6f6e69]">
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
      <div className="min-h-screen bg-[#f3f2ed] p-6">
        <ErrorState
          title="Failed to load scheduler"
          description="The scheduler jobs could not be loaded. Try again in a moment."
          error={jobs.error instanceof Error ? jobs.error : null}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f2ed] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#1d1d1b]">Scheduler</h1>
            <p className="mt-1 text-sm text-[#6f6e69]">
              Every registered queue + scheduled job. Pause, resume, or run them on demand.
            </p>
          </div>
          {jobs.isFetching ? <Spinner label="Refreshing" /> : null}
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardBody>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                Total jobs
              </p>
              <p className="mt-1 text-2xl font-semibold text-[#1d1d1b]">{list.length}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#256b45]">
                Running
              </p>
              <p className="mt-1 text-2xl font-semibold text-[#256b45]">{running}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#9f3731]">
                Paused
              </p>
              <p className="mt-1 text-2xl font-semibold text-[#9f3731]">{paused}</p>
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
              <EmptyState
                title="No scheduled jobs"
                description="No scheduled jobs are registered."
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
                      Job
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]"
                    >
                      Schedule
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]"
                    >
                      Next run
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e4e2dc]">
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
            className="rounded-xl border border-[#ecccc8] bg-[#fbeeed] px-4 py-3 text-sm text-[#9f3731]"
          >
            Action failed: {action.error?.message ?? 'unknown error'}
          </div>
        ) : null}
      </div>
    </div>
  );
}
