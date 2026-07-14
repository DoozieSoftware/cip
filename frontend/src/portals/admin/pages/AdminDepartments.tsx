import { useState, type FormEvent, type JSX, type ReactNode } from 'react';
import {
  type AdminDepartment,
  type AdminDepartmentInput,
  useAdminDepartments,
  useCreateDepartment,
  useDeleteDepartment,
  useUpdateDepartment,
} from '../api/client';
import { Button, Dialog, EmptyState, Spinner } from '../../moderator/design';

const blank: AdminDepartmentInput = {
  name: '', code: '', parent_id: null, jurisdiction: null, address: null,
  email: null, phone: null, default_sla_minutes: 1440, active: true,
};

function DepartmentForm({ initial, departments, busy, onCancel, onSubmit }: {
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
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" value={draft.name} required onChange={(name) => setDraft({ ...draft, name })} />
        <Field label="Code" value={draft.code} required onChange={(code) => setDraft({ ...draft, code })} />
        <label className="text-sm">
          <span className="font-medium text-slate-700">Parent department</span>
          <select value={draft.parent_id ?? ''} onChange={(event) => setDraft({ ...draft, parent_id: event.target.value || null })} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2">
            <option value="">None</option>
            {departments.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
          </select>
        </label>
        <Field label="Jurisdiction" value={draft.jurisdiction ?? ''} onChange={(jurisdiction) => setDraft({ ...draft, jurisdiction })} />
        <Field label="Email" type="email" value={draft.email ?? ''} onChange={(email) => setDraft({ ...draft, email })} />
        <Field label="Phone" value={draft.phone ?? ''} onChange={(phone) => setDraft({ ...draft, phone })} />
        <Field label="Default SLA (minutes)" type="number" value={String(draft.default_sla_minutes ?? '')} onChange={(value) => setDraft({ ...draft, default_sla_minutes: Number(value) })} />
      </div>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Office address</span>
        <textarea value={draft.address ?? ''} onChange={(event) => setDraft({ ...draft, address: event.target.value })} rows={2} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /> Active</label>
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save department'}</Button></div>
    </form>
  );
}

function Field({ label, value, type = 'text', required = false, onChange }: { label: string; value: string; type?: string; required?: boolean; onChange: (value: string) => void }): JSX.Element {
  return <label className="text-sm"><span className="font-medium text-slate-700">{label}{required ? ' *' : ''}</span><input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" /></label>;
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
    editing ? update.mutate({ id: editing.id, ...input }, { onSuccess: done }) : create.mutate(input, { onSuccess: done });
  };

  return <div className="space-y-4">
    <header className="flex items-end justify-between"><div><h1 className="text-2xl font-bold text-slate-900">Departments</h1><p className="text-sm text-slate-600">Manage civic departments, hierarchy, jurisdiction, and default SLA.</p></div><Button onClick={() => { setEditing(null); setOpen(true); }}>+ New department</Button></header>
    {list.isLoading ? <Spinner label="Loading departments" /> : departments.length === 0 ? <EmptyState title="No departments" /> : <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr><TH>Name</TH><TH>Jurisdiction</TH><TH>SLA</TH><TH>Status</TH><TH>Actions</TH></tr></thead><tbody className="divide-y divide-slate-200">{departments.map((item) => <tr key={item.id}><TD><strong>{item.name}</strong><div className="text-xs text-slate-500">{item.code}</div></TD><TD>{item.jurisdiction ?? '-'}</TD><TD>{item.default_sla_minutes ? `${item.default_sla_minutes} min` : '-'}</TD><TD>{item.active ? 'Active' : 'Inactive'}</TD><TD><div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => { setEditing(item); setOpen(true); }}>Edit</Button><Button size="sm" variant="danger" onClick={() => { if (confirm(`Delete ${item.name}?`)) remove.mutate(item.id); }}>Delete</Button></div></TD></tr>)}</tbody></table></div>}
    <Dialog open={open} onClose={() => setOpen(false)} title={editing ? `Edit: ${editing.name}` : 'New department'}><DepartmentForm key={editing?.id ?? 'new'} initial={initial} departments={departments.filter((item) => item.id !== editing?.id)} busy={create.isPending || update.isPending} onCancel={() => setOpen(false)} onSubmit={submit} /></Dialog>
  </div>;
}

function TH({ children }: { children: string }): JSX.Element { return <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">{children}</th>; }
function TD({ children }: { children: ReactNode }): JSX.Element { return <td className="px-4 py-3 text-sm text-slate-700">{children}</td>; }
