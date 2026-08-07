import { useState, type ChangeEvent, type FormEvent, type JSX } from 'react';
import {
  type AdminDepartment,
  type AdminDepartmentInput,
  useAdminDepartments,
  useCreateDepartment,
  useDeleteDepartment,
  useUpdateDepartment,
} from '../api/client';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  Spinner,
} from '../../moderator/design';
import {
  IconBuilding,
  IconPlus,
  IconEdit,
  IconTrash,
  IconMapPin,
  IconClock,
  IconCheck,
  IconX,
} from '@tabler/icons-react';

const blank: AdminDepartmentInput = {
  name: '',
  code: '',
  parent_id: null,
  jurisdiction: null,
  address: null,
  email: null,
  phone: null,
  default_sla_minutes: 1440,
  active: true,
};

function DepartmentForm({
  initial,
  departments,
  busy,
  onCancel,
  onSubmit,
}: {
  initial: AdminDepartmentInput;
  departments: AdminDepartment[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: AdminDepartmentInput) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(initial);
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    onSubmit({
      ...draft,
      name: draft.name.trim(),
      code: draft.code.trim(),
      jurisdiction: draft.jurisdiction?.trim() || null,
      address: draft.address?.trim() || null,
      email: draft.email?.trim() || null,
      phone: draft.phone?.trim() || null,
      default_sla_minutes: Number(draft.default_sla_minutes) || null,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Name"
          name="name"
          value={draft.name}
          required
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setDraft({ ...draft, name: event.target.value })
          }
          className="w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
        />
        <Input
          label="Code"
          name="code"
          value={draft.code}
          required
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setDraft({ ...draft, code: event.target.value })
          }
          className="w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
        />
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
            Parent department
          </span>
          <select
            value={draft.parent_id ?? ''}
            onChange={(event) => setDraft({ ...draft, parent_id: event.target.value || null })}
            className="mt-1 block h-12 w-full rounded-xl border border-[#d0cec8] bg-white px-4 text-sm text-[#1d1d1b] focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
          >
            <option value="">None</option>
            {departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.code})
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Jurisdiction"
          name="jurisdiction"
          value={draft.jurisdiction ?? ''}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setDraft({ ...draft, jurisdiction: event.target.value })
          }
          className="w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
        />
        <Input
          label="Email"
          name="email"
          type="email"
          value={draft.email ?? ''}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setDraft({ ...draft, email: event.target.value })
          }
          className="w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
        />
        <Input
          label="Phone"
          name="phone"
          value={draft.phone ?? ''}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setDraft({ ...draft, phone: event.target.value })
          }
          className="w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
        />
        <Input
          label="Default SLA (minutes)"
          name="default_sla_minutes"
          type="number"
          value={String(draft.default_sla_minutes ?? '')}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setDraft({ ...draft, default_sla_minutes: Number(event.target.value) })
          }
          className="w-full rounded-xl border border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
        />
      </div>
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
          Office address
        </span>
        <textarea
          value={draft.address ?? ''}
          onChange={(event) => setDraft({ ...draft, address: event.target.value })}
          rows={2}
          className="mt-1 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-sm text-[#1d1d1b] focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-[#1d1d1b]">
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
          className="h-4 w-4 rounded border-[#d0cec8] text-[#1d1d1b] focus:ring-[#1d1d1b]"
        />
        Active
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving...' : 'Save department'}
        </Button>
      </div>
    </form>
  );
}

export default function AdminDepartments(): JSX.Element {
  const list = useAdminDepartments();
  const create = useCreateDepartment();
  const update = useUpdateDepartment();
  const remove = useDeleteDepartment();
  const [editing, setEditing] = useState<AdminDepartment | null>(null);
  const [open, setOpen] = useState(false);
  const departments = list.data ?? [];
  const initial: AdminDepartmentInput = editing ? { ...editing } : blank;
  const submit = (input: AdminDepartmentInput): void => {
    const done = (): void => setOpen(false);
    if (editing) {
      update.mutate({ id: editing.id, ...input }, { onSuccess: done });
    } else {
      create.mutate(input, { onSuccess: done });
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f2ed] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#85847f]">
              Platform configuration
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.01em] text-[#1d1d1b]">
              Departments
            </h1>
            <p className="mt-1 text-sm text-[#6f6e69]">
              Manage civic departments, hierarchy, jurisdiction, and default SLA.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            leftIcon={<IconPlus className="h-4 w-4" stroke={1.8} />}
          >
            New department
          </Button>
        </header>

        {list.isLoading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Spinner label="Loading departments" />
          </div>
        ) : list.isError || !list.data ? (
          <ErrorState
            title="Could not load departments"
            description="The departments endpoint did not respond."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void list.refetch();
                }}
              >
                Retry
              </Button>
            }
          />
        ) : departments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d0cec8] bg-white p-10 text-center">
            <EmptyState
              title="No departments"
              description="Create a department to start organizing civic response teams."
            />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#efeee9]">
                  <IconBuilding className="h-4 w-4 text-[#6f6e69]" stroke={1.6} />
                </span>
                <CardTitle>All departments</CardTitle>
              </div>
              <span className="text-sm text-[#85847f]">
                {departments.length} {departments.length === 1 ? 'department' : 'departments'}
              </span>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-[#f3f2ed] text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                  <tr className="border-b border-[#e4e2dc]">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Jurisdiction</th>
                    <th className="px-5 py-3 font-medium">SLA</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e4e2dc]">
                  {departments.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-3">
                        <div className="text-sm font-medium text-[#1d1d1b]">{item.name}</div>
                        <div className="font-mono text-xs text-[#85847f]">{item.code}</div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <IconMapPin className="h-3.5 w-3.5 text-[#85847f]" stroke={1.6} />
                          <span className="text-sm text-[#1d1d1b]">{item.jurisdiction ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <IconClock className="h-3.5 w-3.5 text-[#85847f]" stroke={1.6} />
                          <span className="text-sm text-[#1d1d1b]">
                            {item.default_sla_minutes ? `${item.default_sla_minutes} min` : '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          tone={item.active ? 'success' : 'neutral'}
                          className={
                            item.active
                              ? 'bg-[#edf7f0] text-[#256b45] ring-0'
                              : 'bg-[#efeee9] text-[#6f6e69] ring-0'
                          }
                        >
                          <span className="flex items-center gap-1">
                            {item.active ? (
                              <IconCheck className="h-3 w-3" stroke={2} />
                            ) : (
                              <IconX className="h-3 w-3" stroke={2} />
                            )}
                            {item.active ? 'Active' : 'Inactive'}
                          </span>
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditing(item);
                              setOpen(true);
                            }}
                            leftIcon={<IconEdit className="h-3.5 w-3.5" stroke={1.6} />}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              if (confirm(`Delete ${item.name}?`)) remove.mutate(item.id);
                            }}
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
          </Card>
        )}

        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title={editing ? `Edit: ${editing.name}` : 'New department'}
          size="lg"
        >
          <DepartmentForm
            key={editing?.id ?? 'new'}
            initial={initial}
            departments={departments.filter((item) => item.id !== editing?.id)}
            busy={create.isPending || update.isPending}
            onCancel={() => setOpen(false)}
            onSubmit={submit}
          />
        </Dialog>
      </div>
    </div>
  );
}
