import { useState, type FormEvent, type JSX } from 'react';
import {
  useAdminRoles,
  useAdminPermissions,
  useCreateRole,
  useUpdateRole,
  useSyncRolePermissions,
  type AdminRole,
  type AdminPermission,
  type AdminRoleInput,
} from '../api/client';
import { Spinner, EmptyState, Dialog, Button } from '../../moderator/design';

interface RoleDraft {
  id?: string | number;
  name: string;
  guard_name: string;
  permissions: string[];
}

const blank: RoleDraft = { name: '', guard_name: 'web', permissions: [] };

function RoleForm({ initial, allPerms, onSubmit, onCancel, busy }: {
  initial: RoleDraft;
  allPerms: AdminPermission[];
  onSubmit: (v: AdminRoleInput & { id?: string | number }) => void;
  onCancel: () => void;
  busy: boolean;
}): JSX.Element {
  const [draft, setDraft] = useState<RoleDraft>(initial);

  const togglePerm = (p: string): void => {
    setDraft((d) => ({
      ...d,
      permissions: d.permissions.includes(p) ? d.permissions.filter((x) => x !== p) : [...d.permissions, p],
    }));
  };

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    const payload: AdminRoleInput & { id?: string | number } = {
      name: draft.name,
      guard_name: draft.guard_name,
      permissions: draft.permissions,
    };
    if (initial.id !== undefined) payload.id = initial.id;
    onSubmit(payload);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Name <span className="text-rose-600">*</span></span>
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Guard</span>
        <input
          value={draft.guard_name}
          onChange={(e) => setDraft({ ...draft, guard_name: e.target.value })}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </label>
      <fieldset className="text-sm">
        <legend className="font-medium text-slate-700">Permissions (subset enforced — see note)</legend>
        <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-slate-200 p-2">
          <div className="flex flex-wrap gap-1.5">
            {allPerms.map((p) => {
              const checked = draft.permissions.includes(p.name);
              return (
                <label key={String(p.id)} className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={checked} onChange={() => togglePerm(p.name)} className="h-4 w-4 rounded border-slate-300" />
                  <span className="font-mono">{p.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      </fieldset>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save role'}</Button>
      </div>
    </form>
  );
}

export default function AdminRoles(): JSX.Element {
  const roles = useAdminRoles();
  const perms = useAdminPermissions();
  const create = useCreateRole();
  const update = useUpdateRole();
  const sync = useSyncRolePermissions();

  const [editing, setEditing] = useState<AdminRole | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const allPerms = perms.data ?? [];

  const openNew = (): void => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (r: AdminRole): void => {
    setEditing(r);
    setDialogOpen(true);
  };

  const toDraft = (r: AdminRole | null): RoleDraft =>
    r
      ? { id: r.id, name: r.name, guard_name: r.guard_name, permissions: r.permissions }
      : blank;

  const onSubmit = (v: AdminRoleInput & { id?: string | number }): void => {
    const { id, ...body } = v;
    const close = (): void => setDialogOpen(false);
    if (id === undefined) {
      create.mutate(body, { onSuccess: close });
    } else {
      // Update name/guard, then sync permissions (two endpoints).
      update.mutate({ id: String(id), name: body.name, guard_name: body.guard_name }, {
        onSuccess: () => {
          sync.mutate({ id: String(id), permissions: body.permissions ?? [] }, { onSuccess: close });
        },
      });
    }
  };

  const busy = create.isPending || update.isPending || sync.isPending;

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Roles &amp; permissions</h1>
          <p className="text-sm text-slate-600">Define roles and which permission strings they carry.</p>
        </div>
        <Button onClick={openNew}>+ New role</Button>
      </header>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <span className="font-semibold">Partially enforced.</span> Permissions assigned here grant access to
        platform-wide screens (moderation &amp; analytics views, dashboards, report lists, audit log, security).
        Report- and department-specific actions — approve, accept, resolve, and similar — stay governed by a
        user&rsquo;s role and their department membership; assigning those permissions here does not yet affect them.
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Roles</h2>
          {roles.isLoading ? <Spinner label="Loading roles" /> : (roles.data ?? []).length === 0 ? (
            <EmptyState title="No roles" />
          ) : (
            <ul className="mt-3 space-y-2">
              {(roles.data ?? []).map((r: AdminRole) => (
                <li key={String(r.id)} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">{r.name}</span>
                    <div className="flex items-center gap-2">
                      {r.protected && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">protected</span>}
                      <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Edit</Button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{r.permissions.length} permission(s) · guard: {r.guard_name}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.permissions.slice(0, 6).map((p) => (
                      <span key={p} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">{p}</span>
                    ))}
                    {r.permissions.length > 6 && (
                      <span className="text-xs text-slate-500">+ {r.permissions.length - 6} more</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Permissions</h2>
          {perms.isLoading ? <Spinner label="Loading permissions" /> : (perms.data ?? []).length === 0 ? (
            <EmptyState title="No permissions" />
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-1.5">
              {(perms.data ?? []).map((p) => (
                <li key={String(p.id)} className="rounded bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700">{p.name}</li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? `Edit role: ${editing.name}` : 'New role'}
        size="lg"
      >
        <RoleForm
          initial={toDraft(editing)}
          allPerms={allPerms}
          onSubmit={onSubmit}
          onCancel={() => setDialogOpen(false)}
          busy={busy}
        />
        {create.isError ? (
          <p role="alert" className="mt-2 text-sm text-rose-700">{create.error?.message}</p>
        ) : null}
        {update.isError || sync.isError ? (
          <p role="alert" className="mt-2 text-sm text-rose-700">{update.error?.message ?? sync.error?.message}</p>
        ) : null}
      </Dialog>
    </div>
  );
}
