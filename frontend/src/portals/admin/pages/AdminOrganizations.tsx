import { useState, type FormEvent, type JSX } from 'react';
import {
  type AdminOrganization,
  type AdminOrganizationInput,
  useAdminOrganizations,
  useCreateOrganization,
  useDeleteOrganization,
  useUpdateOrganization,
} from '../api/client';
import { Button, Dialog, EmptyState, Spinner, Card, CardBody } from '../../moderator/design';
import { IconBuilding, IconPlus, IconPencil, IconTrash } from '@tabler/icons-react';

const blank: AdminOrganizationInput = {
  code: '',
  name: '',
  legal_name: null,
  domain: null,
  storage_quota_mb: 10240,
  active: true,
};

function OrganizationForm({
  initial,
  busy,
  onCancel,
  onSubmit,
}: {
  initial: AdminOrganizationInput;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: AdminOrganizationInput) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(initial);
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    onSubmit({
      ...draft,
      code: draft.code.trim(),
      name: draft.name.trim(),
      legal_name: draft.legal_name?.trim() || null,
      domain: draft.domain?.trim() || null,
      storage_quota_mb: Number(draft.storage_quota_mb) || 0,
    });
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Name"
          value={draft.name}
          required
          onChange={(name) => setDraft({ ...draft, name })}
        />
        <Field
          label="Code"
          value={draft.code}
          required
          onChange={(code) => setDraft({ ...draft, code })}
        />
        <Field
          label="Legal name"
          value={draft.legal_name ?? ''}
          onChange={(legal_name) => setDraft({ ...draft, legal_name })}
        />
        <Field
          label="Domain"
          value={draft.domain ?? ''}
          onChange={(domain) => setDraft({ ...draft, domain })}
        />
        <Field
          label="Storage quota (MB)"
          type="number"
          value={String(draft.storage_quota_mb)}
          onChange={(value) => setDraft({ ...draft, storage_quota_mb: Number(value) })}
        />
      </div>
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
          {busy ? 'Saving...' : 'Save organization'}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  type = 'text',
  required = false,
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  required?: boolean;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <label className="block text-sm">
      <span className="font-medium text-[#1d1d1b]">
        {label}
        {required ? <span className="text-[#a42f29]"> *</span> : ''}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-sm focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
      />
    </label>
  );
}

export default function AdminOrganizations(): JSX.Element {
  const list = useAdminOrganizations();
  const create = useCreateOrganization();
  const update = useUpdateOrganization();
  const remove = useDeleteOrganization();
  const [editing, setEditing] = useState<AdminOrganization | null>(null);
  const [open, setOpen] = useState(false);
  const rows = list.data ?? [];

  const submit = (input: AdminOrganizationInput): void => {
    const done = (): void => setOpen(false);
    if (editing) {
      update.mutate({ id: editing.id, ...input }, { onSuccess: done });
    } else {
      create.mutate(input, { onSuccess: done });
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#1d1d1b]">Organizations</h1>
          <p className="mt-0.5 text-sm text-[#6f6e69]">
            Manage tenant identity, domains, quotas, and activation.
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<IconPlus className="h-4 w-4" stroke={1.8} />}
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          New organization
        </Button>
      </header>

      {list.isLoading ? (
        <Spinner label="Loading organizations" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No organizations"
          description="Create an organization to prepare multi-tenant isolation."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((item) => (
            <Card key={item.id}>
              <CardBody>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#efeee9]">
                      <IconBuilding className="h-4 w-4 text-[#6f6e69]" stroke={1.7} />
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold text-[#1d1d1b]">{item.name}</h2>
                      <p className="text-xs text-[#85847f]">
                        {item.code}
                        {item.domain ? ` - ${item.domain}` : ''}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${item.active ? 'bg-[#edf7f0] text-[#256b45]' : 'bg-[#efeee9] text-[#6f6e69]'}`}
                  >
                    {item.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="mt-3 text-sm text-[#6f6e69]">
                  Storage quota: {item.storage_quota_mb.toLocaleString()} MB
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<IconPencil className="h-3.5 w-3.5" stroke={1.7} />}
                    onClick={() => {
                      setEditing(item);
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    leftIcon={<IconTrash className="h-3.5 w-3.5" stroke={1.7} />}
                    onClick={() => {
                      if (confirm(`Delete ${item.name}?`)) remove.mutate(item.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit: ${editing.name}` : 'New organization'}
        size="lg"
      >
        <OrganizationForm
          key={editing?.id ?? 'new'}
          initial={editing ? { ...editing } : blank}
          busy={create.isPending || update.isPending}
          onCancel={() => setOpen(false)}
          onSubmit={submit}
        />
      </Dialog>
    </div>
  );
}
