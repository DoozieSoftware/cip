import { useState, type FormEvent, type JSX } from 'react';
import {
  type AdminOrganization,
  type AdminOrganizationInput,
  useAdminOrganizations,
  useCreateOrganization,
  useDeleteOrganization,
  useUpdateOrganization,
} from '../api/client';
import {
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Spinner,
  Card,
  CardBody,
  Badge,
} from '../../../shared/ui';
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
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
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
      <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
          className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-ink)] focus:ring-[var(--color-ink)]"
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
      <span className="font-medium text-[var(--color-ink)]">
        {label}
        {required ? <span className="text-[var(--color-danger)]"> *</span> : ''}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 block w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm focus:border-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-ink)]"
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
  const [deleteTarget, setDeleteTarget] = useState<AdminOrganization | null>(null);
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
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            Platform / Tenants
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
            Organizations
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
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
        <div className="flex min-h-[200px] items-center justify-center py-16">
          <Spinner label="Loading organizations" />
        </div>
      ) : list.isError ? (
        <ErrorState
          title="Failed to load organizations"
          description="There was a problem fetching organizations."
          error={list.error instanceof Error ? list.error : null}
          action={
            <Button variant="secondary" size="sm" onClick={() => void list.refetch()}>
              Retry
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No organizations"
          description="Create an organization to prepare multi-tenant isolation."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((item) => (
            <Card key={item.id}>
              <CardBody>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                      <IconBuilding
                        className="h-4 w-4 text-[var(--color-text-secondary)]"
                        stroke={1.7}
                      />
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold text-[var(--color-ink)]">{item.name}</h2>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {item.code}
                        {item.domain ? ` - ${item.domain}` : ''}
                      </p>
                    </div>
                  </div>
                  <Badge
                    tone={item.active ? 'success' : 'neutral'}
                    className={
                      item.active
                        ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                        : undefined
                    }
                  >
                    {item.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
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
                    onClick={() => setDeleteTarget(item)}
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

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : 'Delete organization'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => {
                if (deleteTarget)
                  remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-text-secondary)]">
          This action cannot be undone. The organization will be removed permanently.
        </p>
      </Dialog>
    </div>
  );
}
