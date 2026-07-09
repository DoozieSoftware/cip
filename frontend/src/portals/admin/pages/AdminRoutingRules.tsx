import { useState, type FormEvent, type JSX } from 'react';
import {
  useRoutingRules,
  useCreateRoutingRule,
  useUpdateRoutingRule,
  useDeleteRoutingRule,
  type RoutingRule,
} from '../api/client';
import { Spinner } from '../../moderator/design';
import { cx } from '../../moderator/design/cx';

const blank: Partial<RoutingRule> = {
  name: '',
  description: '',
  conditions: { any_label: [] },
  destination_department_id: null,
  priority: 50,
  active: true,
  default_priority_id: null,
  default_sla_minutes: null,
};

function RuleForm({ initial, onSubmit, onCancel, busy }: {
  initial: Partial<RoutingRule>;
  onSubmit: (v: Partial<RoutingRule>) => void;
  onCancel: () => void;
  busy: boolean;
}): JSX.Element {
  const [name, setName] = useState(initial.name ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [department, setDepartment] = useState(initial.destination_department_id ?? '');
  const [priority, setPriority] = useState(initial.priority ?? 50);
  const [active, setActive] = useState(initial.active ?? true);
  const [defaultPriority, setDefaultPriority] = useState(initial.default_priority_id ?? '');
  const [defaultSla, setDefaultSla] = useState(initial.default_sla_minutes ?? '');
  const [conditionsJson, setConditionsJson] = useState(JSON.stringify(initial.conditions ?? { any_label: [] }, null, 2));

  const handle = (e: FormEvent): void => {
    e.preventDefault();
    let parsed: Record<string, unknown>;
    try {
      const obj: unknown = JSON.parse(conditionsJson);
      parsed = (obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : { any_label: [] }) as Record<string, unknown>;
    } catch {
      parsed = { any_label: [] };
    }
    onSubmit({
      ...initial,
      name: name.trim(),
      description: description.trim() || null,
      destination_department_id: department.trim() || null,
      priority: Number(priority),
      active,
      default_priority_id: defaultPriority.trim() || null,
      default_sla_minutes: defaultSla === '' ? null : Number(defaultSla),
      conditions: parsed,
    });
  };

  return (
    <form onSubmit={handle} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium text-slate-700">Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </label>
        <label className="text-sm">
          <span className="font-medium text-slate-700">Priority (lower = first)</span>
          <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-slate-700">Description</span>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-slate-700">Destination department ID <span className="text-rose-600">*</span></span>
          <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} required placeholder="UUID" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </label>
        <label className="text-sm">
          <span className="font-medium text-slate-700">Default priority ID <span className="text-rose-600">*</span></span>
          <input type="text" value={defaultPriority} onChange={(e) => setDefaultPriority(e.target.value)} required placeholder="UUID" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </label>
        <label className="text-sm">
          <span className="font-medium text-slate-700">Default SLA (minutes) <span className="text-rose-600">*</span></span>
          <input type="number" min={0} value={defaultSla} onChange={(e) => setDefaultSla(e.target.value)} required placeholder="e.g. 1440" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-slate-700">Conditions (JSON)</span>
          <textarea value={conditionsJson} onChange={(e) => setConditionsJson(e.target.value)} rows={4} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 font-mono text-xs" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          <span className="font-medium text-slate-700">active</span>
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

export default function AdminRoutingRules(): JSX.Element {
  const [editing, setEditing] = useState<RoutingRule | null>(null);
  const [creating, setCreating] = useState(false);
  const list = useRoutingRules();
  const create = useCreateRoutingRule();
  const update = useUpdateRoutingRule();
  const remove = useDeleteRoutingRule();

  const rows = (list.data ?? []).sort((a, b) => a.priority - b.priority);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Routing rules</h1>
          <p className="mt-1 text-sm text-slate-600">Match conditions to a destination department. Order = priority (lowest first).</p>
        </div>
        <button
          type="button"
          onClick={() => { setCreating(true); setEditing(null); }}
          className="rounded-md bg-fuchsia-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-fuchsia-700"
        >
          New rule
        </button>
      </header>

      {creating ? (
        <RuleForm initial={blank} busy={create.isPending} onCancel={() => setCreating(false)} onSubmit={(v) => create.mutate(v, { onSuccess: () => setCreating(false) })} />
      ) : null}

      {editing ? (
        <RuleForm initial={editing} busy={update.isPending} onCancel={() => setEditing(null)} onSubmit={(v) => update.mutate({ id: editing.id, ...v }, { onSuccess: () => setEditing(null) })} />
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {list.isLoading ? (
          <div className="flex items-center justify-center py-16"><Spinner label="Loading rules" /></div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No routing rules defined.</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Priority</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Department</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Active</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3 text-sm tabular-nums text-slate-700">{r.priority}</td>
                  <td className="px-5 py-3 text-sm">
                    <div className="font-medium text-slate-900">{r.name}</div>
                    {r.description ? <div className="text-xs text-slate-500">{r.description}</div> : null}
                  </td>
                  <td className="px-5 py-3 text-sm font-mono text-xs text-slate-500">
                    {r.destination_department_id ? r.destination_department_id.slice(0, 8) + '…' : '—'}
                  </td>
                  <td className="px-5 py-3 text-sm">
                    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide',
                      r.active ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-200 text-slate-700 border-slate-300',
                    )}>
                      {r.active ? 'active' : 'disabled'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button type="button" onClick={() => { setEditing(r); setCreating(false); }} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50">Edit</button>
                      <button type="button" disabled={remove.isPending} onClick={() => { if (confirm(`Delete ${r.name}?`)) remove.mutate(r.id); }} className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-800 hover:bg-rose-100 disabled:opacity-50">Delete</button>
                    </div>
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
