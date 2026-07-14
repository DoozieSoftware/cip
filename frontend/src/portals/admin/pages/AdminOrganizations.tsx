import { useState, type FormEvent, type JSX } from 'react';
import {
  type AdminOrganization,
  type AdminOrganizationInput,
  useAdminOrganizations,
  useCreateOrganization,
  useDeleteOrganization,
  useUpdateOrganization,
} from '../api/client';
import { Button, Dialog, EmptyState, Spinner } from '../../moderator/design';

const blank: AdminOrganizationInput = { code: '', name: '', legal_name: null, domain: null, storage_quota_mb: 10240, active: true };

function OrganizationForm({ initial, busy, onCancel, onSubmit }: { initial: AdminOrganizationInput; busy: boolean; onCancel: () => void; onSubmit: (input: AdminOrganizationInput) => void }): JSX.Element {
  const [draft, setDraft] = useState(initial);
  const submit = (event: FormEvent): void => { event.preventDefault(); onSubmit({ ...draft, code: draft.code.trim(), name: draft.name.trim(), legal_name: draft.legal_name?.trim() || null, domain: draft.domain?.trim() || null, storage_quota_mb: Number(draft.storage_quota_mb) || 0 }); };
  return <form onSubmit={submit} className="space-y-3"><div className="grid gap-3 sm:grid-cols-2">
    <Field label="Name" value={draft.name} required onChange={(name) => setDraft({ ...draft, name })} />
    <Field label="Code" value={draft.code} required onChange={(code) => setDraft({ ...draft, code })} />
    <Field label="Legal name" value={draft.legal_name ?? ''} onChange={(legal_name) => setDraft({ ...draft, legal_name })} />
    <Field label="Domain" value={draft.domain ?? ''} onChange={(domain) => setDraft({ ...draft, domain })} />
    <Field label="Storage quota (MB)" type="number" value={String(draft.storage_quota_mb)} onChange={(value) => setDraft({ ...draft, storage_quota_mb: Number(value) })} />
  </div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /> Active</label><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save organization'}</Button></div></form>;
}

function Field({ label, value, type = 'text', required = false, onChange }: { label: string; value: string; type?: string; required?: boolean; onChange: (value: string) => void }): JSX.Element { return <label className="text-sm"><span className="font-medium text-slate-700">{label}{required ? ' *' : ''}</span><input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" /></label>; }

export default function AdminOrganizations(): JSX.Element {
  const list = useAdminOrganizations(); const create = useCreateOrganization(); const update = useUpdateOrganization(); const remove = useDeleteOrganization();
  const [editing, setEditing] = useState<AdminOrganization | null>(null); const [open, setOpen] = useState(false); const rows = list.data ?? [];
  const submit = (input: AdminOrganizationInput): void => { const done = (): void => setOpen(false); editing ? update.mutate({ id: editing.id, ...input }, { onSuccess: done }) : create.mutate(input, { onSuccess: done }); };
  return <div className="space-y-4"><header className="flex items-end justify-between"><div><h1 className="text-2xl font-bold text-slate-900">Organizations</h1><p className="text-sm text-slate-600">Manage tenant identity, domains, quotas, and activation.</p></div><Button onClick={() => { setEditing(null); setOpen(true); }}>+ New organization</Button></header>
    {list.isLoading ? <Spinner label="Loading organizations" /> : rows.length === 0 ? <EmptyState title="No organizations" description="Create an organization to prepare multi-tenant isolation." /> : <div className="grid gap-3 sm:grid-cols-2">{rows.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex justify-between"><div><h2 className="font-semibold text-slate-900">{item.name}</h2><p className="text-xs text-slate-500">{item.code}{item.domain ? ` - ${item.domain}` : ''}</p></div><span className="text-xs text-slate-600">{item.active ? 'Active' : 'Inactive'}</span></div><p className="mt-3 text-sm text-slate-600">Storage quota: {item.storage_quota_mb.toLocaleString()} MB</p><div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => { setEditing(item); setOpen(true); }}>Edit</Button><Button size="sm" variant="danger" onClick={() => { if (confirm(`Delete ${item.name}?`)) remove.mutate(item.id); }}>Delete</Button></div></article>)}</div>}
    <Dialog open={open} onClose={() => setOpen(false)} title={editing ? `Edit: ${editing.name}` : 'New organization'}><OrganizationForm key={editing?.id ?? 'new'} initial={editing ? { ...editing } : blank} busy={create.isPending || update.isPending} onCancel={() => setOpen(false)} onSubmit={submit} /></Dialog>
  </div>;
}
