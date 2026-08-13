import { useState, type FormEvent, type JSX } from 'react';
import {
  useWorkflows,
  useCreateWorkflow,
  useUpdateWorkflow,
  useDeleteWorkflow,
  type WorkflowDefinition,
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
} from '../../../shared/ui';
import { IconPlus, IconEdit, IconTrash, IconGitBranch, IconArrowRight } from '@tabler/icons-react';

interface StateRow {
  code: string;
  name: string;
  is_terminal: boolean;
}
interface TransitionRow {
  from_state: string;
  to_state: string;
  event: string;
  required_role: string;
}

const blank: Partial<WorkflowDefinition> = {
  code: '',
  name: '',
  description: '',
  states: [],
  transitions: [],
  active: true,
};

function WorkflowForm({
  initial,
  onSubmit,
  onCancel,
  busy,
}: {
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
    (initial.transitions ?? []).map((t) => ({
      from_state: t.from_state_id,
      to_state: t.to_state_id,
      event: t.event,
      required_role: t.required_role ?? '',
    })),
  );

  const setStatesFromJson = (raw: string): void => {
    try {
      const parsed = JSON.parse(raw) as unknown[];
      if (Array.isArray(parsed))
        setStates(
          parsed.map((s) => {
            const r = s as Record<string, unknown>;
            return {
              code: typeof r.code === 'string' ? r.code : '',
              name: typeof r.name === 'string' ? r.name : '',
              is_terminal: Boolean(r.is_terminal),
            };
          }),
        );
    } catch {
      /* ignore malformed */
    }
  };

  const setTransitionsFromJson = (raw: string): void => {
    try {
      const parsed = JSON.parse(raw) as unknown[];
      if (Array.isArray(parsed))
        setTransitions(
          parsed.map((t) => {
            const r = t as Record<string, unknown>;
            return {
              from_state: typeof r.from_state === 'string' ? r.from_state : '',
              to_state: typeof r.to_state === 'string' ? r.to_state : '',
              event: typeof r.event === 'string' ? r.event : '',
              required_role: typeof r.required_role === 'string' ? r.required_role : '',
            };
          }),
        );
    } catch {
      /* ignore malformed */
    }
  };

  const statesJson = JSON.stringify(
    states.map((s) => ({ code: s.code, name: s.name, is_terminal: s.is_terminal })),
    null,
    2,
  );
  const transitionsJson = JSON.stringify(
    transitions.map((t) => ({
      from_state: t.from_state,
      to_state: t.to_state,
      event: t.event,
      required_role: t.required_role,
    })),
    null,
    2,
  );

  const handle = (e: FormEvent): void => {
    e.preventDefault();
    onSubmit({
      code: code.trim(),
      name: name.trim(),
      description: description.trim() || null,
      active,
      states: states.map((s) => ({ code: s.code, name: s.name, is_terminal: s.is_terminal })),
      transitions: transitions.map((t) => ({
        from_state: t.from_state,
        to_state: t.to_state,
        event: t.event,
        required_role: t.required_role || null,
      })),
    });
  };

  return (
    <form
      onSubmit={handle}
      className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium text-[var(--color-ink)]">Code</span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="mt-1.5 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-sm font-mono focus:border-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </label>
        <label className="text-sm">
          <span className="font-medium text-[var(--color-ink)]">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1.5 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-sm focus:border-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-[var(--color-ink)]">Description</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1.5 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-sm focus:border-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--color-border)]"
          />
          <span className="font-medium text-[var(--color-ink)]">active</span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium text-[var(--color-ink)]">States (JSON: key, name, terminal)</span>
          <textarea
            value={statesJson}
            onChange={(e) => setStatesFromJson(e.target.value)}
            rows={5}
            className="mt-1.5 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 font-mono text-xs focus:border-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </label>
        <label className="text-sm">
          <span className="font-medium text-[var(--color-ink)]">
            Transitions (JSON: from, to, action, required_role)
          </span>
          <textarea
            value={transitionsJson}
            onChange={(e) => setTransitionsFromJson(e.target.value)}
            rows={5}
            className="mt-1.5 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 font-mono text-xs focus:border-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-ink)]"
          />
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
    <div className="min-h-screen bg-[var(--color-canvas)] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
              Workflow builder
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Definitions, states, and transitions. The transition matrix shows which role can move
              a report between which states.
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
            New workflow
          </Button>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              Definitions
            </p>
            <p className="mt-1 text-2xl font-semibold text-[var(--color-ink)]">{rows.length}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              Active
            </p>
            <p className="mt-1 text-2xl font-semibold text-[var(--color-success)]">
              {rows.filter((w) => w.active).length}
            </p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              Total transitions
            </p>
            <p className="mt-1 text-2xl font-semibold text-[var(--color-ink)]">
              {rows.reduce((s, w) => s + (w.transitions?.length ?? 0), 0)}
            </p>
          </div>
        </section>

        {creating ? (
          <WorkflowForm
            initial={blank}
            busy={create.isPending}
            onCancel={() => setCreating(false)}
            onSubmit={(v) => create.mutate(v as never, { onSuccess: () => setCreating(false) })}
          />
        ) : null}

        {editing ? (
          <WorkflowForm
            initial={editing}
            busy={update.isPending}
            onCancel={() => setEditing(null)}
            onSubmit={(v) =>
              update.mutate(
                { id: editing.id, ...(v as object) },
                { onSuccess: () => setEditing(null) },
              )
            }
          />
        ) : null}

        <Card>
          <CardHeader className="border-b border-[var(--color-border-subtle)] px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                <IconGitBranch className="h-4 w-4 text-[var(--color-text-secondary)]" stroke={1.6} />
              </span>
              <CardTitle className="text-sm font-semibold text-[var(--color-ink)]">Workflows</CardTitle>
            </div>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {rows.length} definition{rows.length !== 1 ? 's' : ''}
            </span>
          </CardHeader>
          {list.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner label="Loading workflows" />
            </div>
          ) : list.isError ? (
            <div className="p-5">
              <ErrorState
                title="Failed to load workflows"
                description="There was a problem fetching workflow definitions."
              />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No workflow definitions registered"
                description="Create your first workflow to define report states and transitions."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<IconPlus className="h-4 w-4" stroke={1.8} />}
                    onClick={() => setCreating(true)}
                  >
                    New workflow
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[var(--color-canvas)]">
                  <tr>
                    <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      Code / name
                    </th>
                    <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      States
                    </th>
                    <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      Transitions
                    </th>
                    <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {rows.map((w) => (
                    <tr key={w.id}>
                      <td className="px-5 py-3 text-sm">
                        <div className="font-mono text-xs text-[var(--color-text-secondary)]">{w.code}</div>
                        <div className="font-medium text-[var(--color-ink)]">{w.name}</div>
                      </td>
                      <td className="px-5 py-3 text-sm text-[var(--color-ink)]">{w.states?.length ?? 0}</td>
                      <td className="px-5 py-3 text-sm text-[var(--color-ink)]">
                        {w.transitions?.length ?? 0}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <Badge
                          tone={w.active ? 'success' : 'neutral'}
                          className={
                            w.active ? 'bg-[#edf7f0] text-[var(--color-success)]' : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]'
                          }
                        >
                          {w.active ? 'active' : 'disabled'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<IconEdit className="h-3.5 w-3.5" stroke={1.6} />}
                            onClick={() => {
                              setEditing(w);
                              setCreating(false);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<IconGitBranch className="h-3.5 w-3.5" stroke={1.6} />}
                            onClick={() => setOpenId(w.id === openId ? null : w.id)}
                          >
                            {w.id === openId ? 'Hide matrix' : 'Show matrix'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<IconTrash className="h-3.5 w-3.5" stroke={1.6} />}
                            disabled={remove.isPending}
                            onClick={() => {
                              if (confirm(`Delete ${w.code}?`)) remove.mutate(w.id);
                            }}
                            className="text-[var(--color-danger)] hover:bg-[#fbeeed] hover:text-[var(--color-danger-hover)]"
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

        {open ? <TransitionMatrix wf={open} /> : null}
      </div>
    </div>
  );
}

function TransitionMatrix({ wf }: { wf: WorkflowDefinition }): JSX.Element {
  const states = wf.states ?? [];
  const transitions = wf.transitions ?? [];
  const byId = new Map(states.map((s) => [s.id, s.code]));
  const set = new Set(
    transitions.map(
      (t) =>
        `${byId.get(t.from_state_id) ?? t.from_state_id}->${byId.get(t.to_state_id) ?? t.to_state_id}`,
    ),
  );
  return (
    <Card>
      <CardHeader className="border-b border-[var(--color-border-subtle)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-surface-alt)]">
            <IconArrowRight className="h-4 w-4 text-[var(--color-text-secondary)]" stroke={1.6} />
          </span>
          <CardTitle className="text-sm font-semibold text-[var(--color-ink)]">
            Transition matrix — {wf.name}
          </CardTitle>
        </div>
        <span className="text-xs text-[var(--color-text-secondary)]">
          Rows = source, columns = destination. Filled cells = legal transition.
        </span>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="bg-[var(--color-canvas)] px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                from \ to
              </th>
              {states.map((s) => (
                <th
                  key={s.id}
                  className="bg-[var(--color-canvas)] px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]"
                >
                  {s.code}
                  {s.is_terminal ? ' (terminal)' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {states.map((row) => (
              <tr key={row.id} className="border-t border-[var(--color-border-subtle)]">
                <td className="px-3 py-2 text-xs font-medium text-[var(--color-ink)]">{row.code}</td>
                {states.map((col) => {
                  const has = set.has(`${row.code}->${col.code}`);
                  return (
                    <td
                      key={col.id}
                      className={`px-3 py-2 text-xs ${has ? 'bg-[#edf7f0] text-[var(--color-success)]' : 'text-[var(--color-border)]'}`}
                    >
                      {has ? '✓' : '·'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
