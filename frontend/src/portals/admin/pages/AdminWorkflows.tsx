import { useState, type JSX } from 'react';
import { useWorkflows, useDeleteWorkflow, type WorkflowDefinition } from '../api/client';
import { Spinner } from '../../moderator/design';
import { cx } from '../../moderator/design/cx';

export default function AdminWorkflows(): JSX.Element {
  const list = useWorkflows();
  const remove = useDeleteWorkflow();
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = list.data ?? [];
  const open = rows.find((w) => w.id === openId);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Workflow builder</h1>
        <p className="mt-1 text-sm text-slate-600">
          Definitions, states, and transitions. The transition matrix shows which role can move a report between which states.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Definitions</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{rows.length}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Active</div>
          <div className="mt-1 text-2xl font-bold text-emerald-900">{rows.filter((w) => w.active).length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total transitions</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{rows.reduce((s, w) => s + (w.transitions?.length ?? 0), 0)}</div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {list.isLoading ? (
          <div className="flex items-center justify-center py-16"><Spinner label="Loading workflows" /></div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No workflow definitions registered.</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Code / name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">States</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Transitions</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Active</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((w) => (
                <tr key={w.id}>
                  <td className="px-5 py-3 text-sm">
                    <div className="font-mono text-xs text-slate-500">{w.code}</div>
                    <div className="font-medium text-slate-900">{w.name}</div>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-700">{w.states?.length ?? 0}</td>
                  <td className="px-5 py-3 text-sm text-slate-700">{w.transitions?.length ?? 0}</td>
                  <td className="px-5 py-3 text-sm">
                    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide',
                      w.active ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-200 text-slate-700 border-slate-300',
                    )}>
                      {w.active ? 'active' : 'disabled'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button type="button" onClick={() => setOpenId(w.id === openId ? null : w.id)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50">
                        {w.id === openId ? 'Hide matrix' : 'Show matrix'}
                      </button>
                      <button type="button" disabled={remove.isPending} onClick={() => { if (confirm(`Delete ${w.code}?`)) remove.mutate(w.id); }} className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-800 hover:bg-rose-100 disabled:opacity-50">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {open ? <TransitionMatrix wf={open} /> : null}
    </div>
  );
}

function TransitionMatrix({ wf }: { wf: WorkflowDefinition }): JSX.Element {
  const states = wf.states ?? [];
  const transitions = wf.transitions ?? [];
  const set = new Set(transitions.map((t) => `${t.from}->${t.to}`));
  return (
    <section aria-label={`Transition matrix for ${wf.code}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Transition matrix — {wf.name}</h2>
        <p className="text-xs text-slate-500">Rows = source, columns = destination. Filled cells = legal transition.</p>
      </header>
      <table className="min-w-full">
        <thead>
          <tr>
            <th className="bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">from \ to</th>
            {states.map((s) => (
              <th key={s.key} className="bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                {s.key}{s.terminal ? ' (terminal)' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {states.map((row) => (
            <tr key={row.key} className="border-t border-slate-100">
              <td className="px-3 py-2 text-xs font-medium text-slate-700">{row.key}</td>
              {states.map((col) => {
                const has = set.has(`${row.key}->${col.key}`);
                return (
                  <td key={col.key} className={`px-3 py-2 text-xs ${has ? 'bg-emerald-50 text-emerald-800' : 'text-slate-300'}`}>
                    {has ? '✓' : '·'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
