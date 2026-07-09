import { type JSX } from 'react';
import { useSchedulerJobs, useSchedulerAction, type SchedulerJob } from '../api/client';
import { Spinner } from '../../moderator/design';
import { cx } from '../../moderator/design/cx';

function StatusPill({ paused }: { paused: boolean }): JSX.Element {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide',
        paused ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200',
      )}
    >
      <span aria-hidden>{paused ? '⏸' : '▶'}</span>
      {paused ? 'paused' : 'running'}
    </span>
  );
}

function JobRow({ job, busy, onAction }: { job: SchedulerJob; busy: boolean; onAction: (a: 'run-now' | 'pause' | 'resume') => void }): JSX.Element {
  return (
    <tr>
      <td className="px-5 py-3">
        <div className="text-sm font-medium text-slate-900">{job.id}</div>
        {job.command ? <div className="font-mono text-xs text-slate-500">{job.command}</div> : null}
      </td>
      <td className="px-5 py-3 text-sm text-slate-700">
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{job.expression || '—'}</code>
      </td>
      <td className="px-5 py-3 text-sm tabular-nums text-slate-700">
        {job.next_due_at ? new Date(job.next_due_at).toLocaleString() : '—'}
      </td>
      <td className="px-5 py-3 text-sm">
        <StatusPill paused={job.paused} />
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction('run-now')}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            aria-label={`Run ${job.id} now`}
          >
            Run now
          </button>
          {job.paused ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction('resume')}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            >
              Resume
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction('pause')}
              className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              Pause
            </button>
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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Scheduler</h1>
          <p className="mt-1 text-sm text-slate-600">
            Every registered queue + scheduled job. Pause, resume, or run them on demand.
          </p>
        </div>
        {jobs.isFetching ? <Spinner label="Refreshing" /> : null}
      </header>

      <section aria-label="Counts" className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total jobs</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{list.length}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Running</div>
          <div className="mt-1 text-2xl font-bold text-emerald-900">{running}</div>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-rose-700">Paused</div>
          <div className="mt-1 text-2xl font-bold text-rose-900">{paused}</div>
        </div>
      </section>

      <section aria-label="Jobs" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {jobs.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner label="Loading jobs" />
          </div>
        ) : list.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No scheduled jobs registered.</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Job
                </th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Schedule
                </th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Next run
                </th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>
                <th scope="col" className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {list.map((job) => (
                <JobRow key={job.id} job={job} busy={action.isPending} onAction={(a) => handleAction(job.id, a)} />
              ))}
            </tbody>
          </table>
        )}
      </section>

      {action.isError ? (
        <div role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          Action failed: {(action.error)?.message ?? 'unknown error'}
        </div>
      ) : null}
      {action.isSuccess ? (
        <div role="status" className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          Last action: {action.variables?.action} on {action.variables?.id}
        </div>
      ) : null}
    </div>
  );
}
