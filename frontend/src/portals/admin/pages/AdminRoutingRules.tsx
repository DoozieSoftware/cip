import { useState, type FormEvent, type JSX } from 'react';
import {
  useRoutingRules,
  useCreateRoutingRule,
  useUpdateRoutingRule,
  useDeleteRoutingRule,
  useRoutingFormOptions,
  type RoutingRule,
  type RoutingFormOptions,
} from '../api/client';
import {
  Spinner,
  Card,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  EmptyState,
  ErrorState,
} from '../../moderator/design';
import { IconPlus, IconEdit, IconTrash, IconRoute } from '@tabler/icons-react';

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

function RuleForm({
  initial,
  options,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: Partial<RoutingRule>;
  options: RoutingFormOptions;
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
  const [conditionsJson, setConditionsJson] = useState(
    JSON.stringify(initial.conditions ?? { any_label: [] }, null, 2),
  );

  const handle = (e: FormEvent): void => {
    e.preventDefault();
    let parsed: Record<string, unknown>;
    try {
      const obj: unknown = JSON.parse(conditionsJson);
      parsed = (
        obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : { any_label: [] }
      ) as Record<string, unknown>;
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
    <form
      onSubmit={handle}
      className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium text-[#1d1d1b]">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1.5 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-sm focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
          />
        </label>
        <label className="text-sm">
          <span className="font-medium text-[#1d1d1b]">Priority (lower = first)</span>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="mt-1.5 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-sm focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-[#1d1d1b]">Description</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1.5 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-sm focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-[#1d1d1b]">
            Destination department <span className="text-[#a42f29]">*</span>
          </span>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            required
            className="mt-1.5 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-sm focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
          >
            <option value="">Select a department</option>
            {options.departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.code})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium text-[#1d1d1b]">
            Default priority <span className="text-[#a42f29]">*</span>
          </span>
          <select
            value={defaultPriority}
            onChange={(e) => setDefaultPriority(e.target.value)}
            required
            className="mt-1.5 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-sm focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
          >
            <option value="">Select a priority</option>
            {options.priorities.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.code})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium text-[#1d1d1b]">
            Default SLA (minutes) <span className="text-[#a42f29]">*</span>
          </span>
          <input
            type="number"
            min={0}
            value={defaultSla}
            onChange={(e) => setDefaultSla(e.target.value)}
            required
            placeholder="e.g. 1440"
            className="mt-1.5 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-sm focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-[#1d1d1b]">Conditions (JSON)</span>
          <textarea
            value={conditionsJson}
            onChange={(e) => setConditionsJson(e.target.value)}
            rows={4}
            className="mt-1.5 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 font-mono text-xs focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-[#d0cec8]"
          />
          <span className="font-medium text-[#1d1d1b]">active</span>
        </label>
      </div>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" loading={busy} type="submit">
          {busy ? 'Saving…' : initial.id ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}

export default function AdminRoutingRules(): JSX.Element {
  const [editing, setEditing] = useState<RoutingRule | null>(null);
  const [creating, setCreating] = useState(false);
  const list = useRoutingRules();
  const options = useRoutingFormOptions();
  const create = useCreateRoutingRule();
  const update = useUpdateRoutingRule();
  const remove = useDeleteRoutingRule();

  const rows = (list.data ?? []).sort((a, b) => a.priority - b.priority);

  return (
    <div className="min-h-screen bg-[#f3f2ed] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#1d1d1b]">
              Routing rules
            </h1>
            <p className="mt-1 text-sm text-[#6f6e69]">
              Match conditions to a destination department. Order = priority (lowest first).
            </p>
          </div>
          <Button
            variant="primary"
            leftIcon={<IconPlus className="h-4 w-4" stroke={1.8} />}
            onClick={() => {
              setCreating(true);
              setEditing(null);
            }}
          >
            New rule
          </Button>
        </header>

        {creating ? (
          <RuleForm
            initial={blank}
            options={options.data ?? { departments: [], priorities: [] }}
            busy={create.isPending}
            onCancel={() => setCreating(false)}
            onSubmit={(v) => create.mutate(v, { onSuccess: () => setCreating(false) })}
          />
        ) : null}

        {editing ? (
          <RuleForm
            initial={editing}
            options={options.data ?? { departments: [], priorities: [] }}
            busy={update.isPending}
            onCancel={() => setEditing(null)}
            onSubmit={(v) =>
              update.mutate({ id: editing.id, ...v }, { onSuccess: () => setEditing(null) })
            }
          />
        ) : null}

        <Card>
          <CardHeader className="border-b border-[#e4e2dc] px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#efeee9]">
                <IconRoute className="h-4 w-4 text-[#6f6e69]" stroke={1.6} />
              </span>
              <CardTitle className="text-sm font-semibold text-[#1d1d1b]">All rules</CardTitle>
            </div>
            <span className="text-xs text-[#85847f]">
              {rows.length} rule{rows.length !== 1 ? 's' : ''}
            </span>
          </CardHeader>
          {list.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner label="Loading rules" />
            </div>
          ) : list.isError ? (
            <div className="p-5">
              <ErrorState
                title="Failed to load rules"
                description="There was a problem fetching routing rules."
              />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No routing rules defined"
                description="Create your first rule to start matching reports to departments."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<IconPlus className="h-4 w-4" stroke={1.8} />}
                    onClick={() => setCreating(true)}
                  >
                    New rule
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[#f3f2ed]">
                  <tr>
                    <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                      Priority
                    </th>
                    <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                      Name
                    </th>
                    <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                      Department
                    </th>
                    <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e4e2dc]">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-3 text-sm tabular-nums text-[#1d1d1b]">
                        {r.priority}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <div className="font-medium text-[#1d1d1b]">{r.name}</div>
                        {r.description ? (
                          <div className="text-xs text-[#6f6e69]">{r.description}</div>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-sm text-[#1d1d1b]">
                        {r.destination_department?.name ?? '—'}
                        {r.destination_department?.code ? (
                          <div className="text-xs text-[#6f6e69]">
                            {r.destination_department.code}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <Badge
                          tone={r.active ? 'success' : 'neutral'}
                          className={
                            r.active ? 'bg-[#edf7f0] text-[#256b45]' : 'bg-[#efeee9] text-[#6f6e69]'
                          }
                        >
                          {r.active ? 'active' : 'disabled'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<IconEdit className="h-3.5 w-3.5" stroke={1.6} />}
                            onClick={() => {
                              setEditing(r);
                              setCreating(false);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<IconTrash className="h-3.5 w-3.5" stroke={1.6} />}
                            disabled={remove.isPending}
                            onClick={() => {
                              if (confirm(`Delete ${r.name}?`)) remove.mutate(r.id);
                            }}
                            className="text-[#a42f29] hover:bg-[#fbeeed] hover:text-[#8a2621]"
                          >
                            Delete
                          </Button>
                        </div>
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
