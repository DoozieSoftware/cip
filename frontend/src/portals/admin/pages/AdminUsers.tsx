import { useState, type FormEvent, type JSX } from 'react';
import {
  IconSearch,
  IconUserPlus,
  IconEdit,
  IconTrash,
  IconX,
  IconCheck,
} from '@tabler/icons-react';
import {
  useAdminUsers,
  useAdminRoles,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  type AdminUser,
  type AdminUserInput,
} from '../api/client';
import {
  Spinner,
  EmptyState,
  ErrorState,
  Dialog,
  Button,
  Card,
  CardBody,
} from '../../../shared/ui';

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

function UserForm({
  initial,
  roles,
  onSubmit,
  onCancel,
  busy,
}: {
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
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm">
        <span className="font-medium text-[var(--color-ink)]">Name</span>
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-[var(--color-ink)]">
          Mobile <span className="text-[var(--color-danger)]">*</span>
        </span>
        <input
          value={draft.mobile}
          onChange={(e) => setDraft({ ...draft, mobile: e.target.value })}
          required
          className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-[var(--color-ink)]">Email</span>
        <input
          type="email"
          value={draft.email}
          onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-[var(--color-ink)]">
          {initial.id ? 'Password (leave blank to keep)' : 'Password'}{' '}
          {!initial.id && <span className="text-[var(--color-danger)]">*</span>}
        </span>
        <input
          type="password"
          value={draft.password}
          onChange={(e) => setDraft({ ...draft, password: e.target.value })}
          required={!initial.id}
          className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-[var(--color-ink)]">Status</span>
        <select
          value={draft.status}
          onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="text-sm">
        <legend className="font-medium text-[var(--color-ink)]">Roles</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {roles.map((r) => {
            const checked = draft.roles.includes(r.name);
            return (
              <label
                key={r.name}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  checked
                    ? 'bg-[var(--color-ink)] text-white'
                    : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleRole(r.name)}
                  className="sr-only"
                />
                {checked && <IconCheck className="h-3 w-3" stroke={2} />}
                {r.name}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={busy}
          leftIcon={<IconX className="h-4 w-4" stroke={1.6} />}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={busy}
          loading={busy}
          leftIcon={<IconCheck className="h-4 w-4" stroke={1.6} />}
        >
          Save user
        </Button>
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
      ? {
          id: u.id,
          name: u.name ?? '',
          mobile: u.mobile,
          email: u.email ?? '',
          password: '',
          status: u.status ?? 'active',
          roles: u.roles,
        }
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
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
            Users
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Every account in the platform.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-auto">
            <IconSearch
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]"
              stroke={1.6}
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, mobile, or email…"
              className="w-full sm:w-72 rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 pl-10 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
            />
          </div>
          <Button onClick={openNew} leftIcon={<IconUserPlus className="h-4 w-4" stroke={1.6} />}>
            New user
          </Button>
        </div>
      </header>

      {users.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner label="Loading users" />
        </div>
      ) : users.isError ? (
        <ErrorState
          title="Failed to load users"
          description="Something went wrong while loading the user list."
        />
      ) : (users.data ?? []).length === 0 ? (
        <EmptyState
          title="No users"
          description="The platform has no users yet (or none match the search)."
          action={
            <Button onClick={openNew} leftIcon={<IconUserPlus className="h-4 w-4" stroke={1.6} />}>
              Create first user
            </Button>
          }
        />
      ) : (
        <Card className="ring-1 ring-black/5">
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-left text-sm">
                <thead>
                  <tr className="bg-[var(--color-canvas)]">
                    <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      Name
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      Mobile
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      Email
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      Roles
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      Joined
                    </th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {(users.data ?? []).map((u: AdminUser) => (
                    <tr key={u.id} className="transition hover:bg-[var(--color-canvas)]">
                      <td className="px-4 py-3 font-medium text-[var(--color-ink)]">
                        {u.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-secondary)]">
                        {u.mobile}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {u.email ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            u.status === 'active'
                              ? 'bg-[#edf7f0] text-[var(--color-success)]'
                              : u.status === 'suspended'
                                ? 'bg-[#fbeeed] text-[var(--color-danger)]'
                                : 'bg-[#fff6e4] text-[#805913]'
                          }`}
                        >
                          {u.status ?? 'active'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <span
                              key={r}
                              className="inline-flex items-center rounded-full bg-[#f3eef6] px-2 py-0.5 text-xs font-medium text-[#6b4593]"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(u)}
                            leftIcon={<IconEdit className="h-3.5 w-3.5" stroke={1.6} />}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => onDelete(u)}
                            leftIcon={<IconTrash className="h-3.5 w-3.5" stroke={1.6} />}
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
          </CardBody>
        </Card>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? 'Edit user' : 'New user'}
        size="lg"
        footer={null}
      >
        <UserForm
          initial={toDraft(editing)}
          roles={roles}
          onSubmit={onSubmit}
          onCancel={() => setDialogOpen(false)}
          busy={busy}
        />
        {create.isError ? (
          <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">
            {create.error?.message}
          </p>
        ) : null}
        {update.isError ? (
          <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">
            {update.error?.message}
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}
