import { useState, type FormEvent, type JSX } from 'react';
import {
  useAdminUsers,
  useAdminRoles,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  type AdminUser,
  type AdminUserInput,
} from '../api/client';
import { Spinner, EmptyState, Dialog, Button } from '../../moderator/design';

interface UserDraft {
  id?: string;
  name: string;
  mobile: string;
  email: string;
  password: string;
  status: string;
  roles: string[];
}

const STATUSES = ['active', 'suspended', 'invited'];

const blank: UserDraft = {
  name: '',
  mobile: '',
  email: '',
  password: '',
  status: 'active',
  roles: [],
};

function UserForm({ initial, roles, onSubmit, onCancel, busy }: {
  initial: UserDraft;
  roles: { name: string }[];
  onSubmit: (v: AdminUserInput & { id?: string }) => void;
  onCancel: () => void;
  busy: boolean;
}): JSX.Element {
  const [draft, setDraft] = useState<UserDraft>(initial);

  const toggleRole = (r: string): void => {
    setDraft((d) => ({
      ...d,
      roles: d.roles.includes(r) ? d.roles.filter((x) => x !== r) : [...d.roles, r],
    }));
  };

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    const payload: AdminUserInput & { id?: string } = {
      name: draft.name || null,
      mobile: draft.mobile,
      email: draft.email || null,
      status: draft.status,
      roles: draft.roles,
    };
    if (draft.password) payload.password = draft.password;
    if (initial.id) payload.id = initial.id;
    onSubmit(payload);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Name</span>
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Mobile <span className="text-rose-600">*</span></span>
        <input
          value={draft.mobile}
          onChange={(e) => setDraft({ ...draft, mobile: e.target.value })}
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Email</span>
        <input
          type="email"
          value={draft.email}
          onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">
          {initial.id ? 'Password (leave blank to keep)' : 'Password'} {!initial.id && <span className="text-rose-600">*</span>}
        </span>
        <input
          type="password"
          value={draft.password}
          onChange={(e) => setDraft({ ...draft, password: e.target.value })}
          required={!initial.id}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Status</span>
        <select
          value={draft.status}
          onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <fieldset className="text-sm">
        <legend className="font-medium text-slate-700">Roles</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {roles.map((r) => {
            const checked = draft.roles.includes(r.name);
            return (
              <label key={r.name} className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={checked} onChange={() => toggleRole(r.name)} className="h-4 w-4 rounded border-slate-300" />
                <span>{r.name}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save user'}</Button>
      </div>
    </form>
  );
}

export default function AdminUsers(): JSX.Element {
  const [q, setQ] = useState<string>('');
  const users = useAdminUsers(q);
  const allRoles = useAdminRoles();
  const create = useCreateUser();
  const update = useUpdateUser();
  const remove = useDeleteUser();

  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const roles = (allRoles.data ?? []).map((r) => ({ name: r.name }));

  const openNew = (): void => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (u: AdminUser): void => {
    setEditing(u);
    setDialogOpen(true);
  };

  const toDraft = (u: AdminUser | null): UserDraft =>
    u
      ? { id: u.id, name: u.name ?? '', mobile: u.mobile, email: u.email ?? '', password: '', status: u.status ?? 'active', roles: u.roles }
      : blank;

  const onSubmit = (v: AdminUserInput & { id?: string }): void => {
    const done = (): void => setDialogOpen(false);
    if (v.id) {
      const { id, ...patch } = v;
      update.mutate({ id, ...patch }, { onSuccess: done });
    } else {
      create.mutate(v, { onSuccess: done });
    }
  };

  const onDelete = (u: AdminUser): void => {
    if (window.confirm(`Delete user ${u.name ?? u.mobile}? This cannot be undone.`)) {
      remove.mutate(u.id);
    }
  };

  const busy = create.isPending || update.isPending;

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-600">Every account in the platform.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, mobile, or email…"
            className="w-72 rounded-md border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-fuchsia-500 focus:ring-fuchsia-500"
          />
          <Button onClick={openNew}>+ New user</Button>
        </div>
      </header>

      {users.isLoading ? (
        <Spinner label="Loading users" />
      ) : (users.data ?? []).length === 0 ? (
        <EmptyState title="No users" description="The platform has no users yet (or none match the search)." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Mobile</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Roles</th>
                <th className="px-4 py-2">Joined</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(users.data ?? []).map((u: AdminUser) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-900">{u.name ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-700">{u.mobile}</td>
                  <td className="px-4 py-2 text-slate-700">{u.email ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{u.status ?? 'active'}</span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <span key={r} className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs text-fuchsia-800">{r}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>Edit</Button>
                      <Button variant="danger" size="sm" onClick={() => onDelete(u)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? 'Edit user' : 'New user'}
      >
        <UserForm
          initial={toDraft(editing)}
          roles={roles}
          onSubmit={onSubmit}
          onCancel={() => setDialogOpen(false)}
          busy={busy}
        />
        {create.isError ? (
          <p role="alert" className="mt-2 text-sm text-rose-700">{create.error?.message}</p>
        ) : null}
        {update.isError ? (
          <p role="alert" className="mt-2 text-sm text-rose-700">{update.error?.message}</p>
        ) : null}
      </Dialog>
    </div>
  );
}
