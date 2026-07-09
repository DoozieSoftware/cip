import { useState, type FormEvent, type JSX } from 'react';
import { useWorkflows, useCreateWorkflow, useUpdateWorkflow, useDeleteWorkflow, type WorkflowDefinition } from '../api/client';
import { Spinner } from '../../moderator/design';
import { cx } from '../../moderator/design/cx';

// Submit payload shape — matches StoreWorkflowRequest / UpdateWorkflowRequest
// (states[].code/name/is_terminal, transitions[].from_state/to_state/event/required_role).
// `from_state`/`to_state` are state *codes*, not IDs.
interface StateRow { code: string; name: string; is_terminal: boolean }
interface TransitionRow { from_state: string; to_state: string; event: string; required_role: string }

const blank: Partial<WorkflowDefinition> = {
  code: '',
  name: '',
  description: '',
  states: [],
  transitions: [],
  active: true,
};

function WorkflowForm({ initial, onSubmit, onCancel, busy }: {
  initial: Partial<WorkflowDefinition>;
  onSubmit: (v: unknown) => void;
  onCancel: () => void;
  busy: boolean;
}): JSX.Element {
  const [code, setCode] = useState(initial.code ?? '');
  const [name, setName] = useState(initial.name ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [active, setActive] = useState(initial.active ?? true);
  const [states, setStates] = useState<StateRow[]>(
    (initial.states ?? []).map((s) => ({ code: s.code, name: s.name, is_terminal: s.is_terminal })),
  );
  const [transitions, setTransitions] = useState<TransitionRow[]>(
    (initial.transitions ?? []).map((t) => ({ from_state: t.from_state_id, to_state: t.to_state_id, event: t.event, required_role: t.required_role ?? '' })),
  );

  const setStatesFromJson = (raw: string): void => {
    try {
      const parsed = JSON.parse(raw) as unknown[];
      if (Array.isArray(parsed)) setStates(parsed.map((s) => {
        const r = s as Record<string, unknown>;
        return {
          code: typeof r.code === 'string' ? r.code : '',
          name: typeof r.name === 'string' ? r.name : '',
          is_terminal: Boolean(r.is_terminal),
        };
      }));
    } catch { /* ignore malformed */ }
  };

  const setTransitionsFromJson = (raw: string): void => {
    try {
      const parsed = JSON.parse(raw) as unknown[];
      if (Array.isArray(parsed)) setTransitions(parsed.map((t) => {
        const r = t as Record<string, unknown>;
        return {
          from_state: typeof r.from_state === 'string' ? r.from_state : '',
          to_state: typeof r.to_state === 'string' ? r.to_state : '',
          event: typeof r.event === 'string' ? r.event : '',
          required_role: typeof r.required_role === 'string' ? r.required_role : '',
        };
      }));
    } catch { /* ignore malformed */ }
  };

  const statesJson = JSON.stringify(states.map((s) => ({ code: s.code, name: s.name, is_terminal: s.is_terminal })), null, 2);
  const transitionsJson = JSON.stringify(transitions.map((t) => ({ from_state: t.from_state, to_state: t.to_state, event: t.event, required_role: t.required_role })), null, 2);

  const handle = (e: FormEvent): void => {
    e.preventDefault();
    onSubmit({
      code: code.trim(),
      name: name.trim(),
      description: description.trim() || null,
      active,
      states: states.map((s) => ({ code: s.code, name: s.name, is_terminal: s.is_terminal })),
      transitions: transitions.map((t) => ({ from_state: t.from_state, to_state: t.to_state, event: t.event, required_role: t.required_role || null })),
    });
  };

  return (
    <form onSubmit={handle} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium text-slate-700">Code</span>
          <input type="text" value={code} onChange={(e) => setCode(e.target.value)} required className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono" />
        </label>
        <label className="text-sm">
          <span className="font-medium text-slate-700">Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-slate-700">Description</span>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          <span className="font-medium text-slate-700">active</span>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium text-slate-700">States (JSON: key, name, terminal)</span>
          <textarea value={statesJson} onChange={(e) => setStatesFromJson(e.target.value)} rows={5} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 font-mono text-xs" />
        </label>
        <label className="text-sm">
          <span className="font-medium text-slate-700">Transitions (JSON: from, to, action, required_role)</span>
          <textarea value={transitionsJson} onChange={(e) => setTransitionsFromJson(e.target.value)} rows={5} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 font-mono text-xs" />
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
        <button type="submit" disabled={busy} className="rounded-md bg-fuchsia-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-fuchsia-700 disabled:opacity-50">
          {busy ? 'Saving…' : initial.id ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

export default function AdminWorkflows(): JSX.Element {
  const list = useWorkflows();
  const create = useCreateWorkflow();
  const update = useUpdateWorkflow();
  const remove = useDeleteWorkflow();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<WorkflowDefinition | null>(null);

  const rows = list.data ?? [];
  const open = rows.find((w) => w.id === openId);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Workflow builder</h1>
          <p className="mt-1 text-sm text-slate-600">
            Definitions, states, and transitions. The transition matrix shows which role can move a report between which states.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setCreating(true); setEditing(null); }}
          className="rounded-md bg-fuchsia-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-fuchsia-700"
        >
          New workflow
        </button>
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

      {creating ? (
        <WorkflowForm initial={blank} busy={create.isPending} onCancel={() => setCreating(false)} onSubmit={(v) => create.mutate(v as never, { onSuccess: () => setCreating(false) })} />
      ) : null}

      {editing ? (
        <WorkflowForm initial={editing} busy={update.isPending} onCancel={() => setEditing(null)} onSubmit={(v) => update.mutate({ id: editing.id, ...(v as object) }, { onSuccess: () => setEditing(null) })} />
      ) : null}

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
                      <button type="button" onClick={() => { setEditing(w); setCreating(false); }} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50">Edit</button>
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
  const byId = new Map(states.map((s) => [s.id, s.code]));
  const set = new Set(transitions.map((t) => `${byId.get(t.from_state_id) ?? t.from_state_id}->${byId.get(t.to_state_id) ?? t.to_state_id}`));
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
              <th key={s.id} className="bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                {s.code}{s.is_terminal ? ' (terminal)' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {states.map((row) => (
            <tr key={row.id} className="border-t border-slate-100">
              <td className="px-3 py-2 text-xs font-medium text-slate-700">{row.code}</td>
              {states.map((col) => {
                const has = set.has(`${row.code}->${col.code}`);
                return (
                  <td key={col.id} className={`px-3 py-2 text-xs ${has ? 'bg-emerald-50 text-emerald-800' : 'text-slate-300'}`}>
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
