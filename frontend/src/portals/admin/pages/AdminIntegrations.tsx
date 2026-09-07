import { useState, type FormEvent, type JSX } from 'react';
import {
  useIntegrations,
  useCreateIntegration,
  useUpdateIntegration,
  useDeleteIntegration,
  useProbeIntegration,
  type Integration,
} from '../api/client';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Spinner,
} from '../../../shared/ui';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral' | 'info'> = {
  active: 'success',
  degraded: 'warning',
  disabled: 'neutral',
  pending: 'info',
};

function StatusPill({ status }: { status: Integration['status'] }): JSX.Element {
  return (
    <Badge
      tone={STATUS_TONE[status] ?? 'neutral'}
      className={
        status === 'active'
          ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
          : status === 'degraded'
            ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
            : status === 'pending'
              ? 'bg-[var(--color-info)]/10 text-[var(--color-info)]'
              : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]'
      }
    >
      {status}
    </Badge>
  );
}

function IntegrationForm({
  initial,
  onSubmit,
  onCancel,
  busy,
}: {
  initial?: Partial<Integration>;
  onSubmit: (v: Partial<Integration>) => void;
  onCancel: () => void;
  busy: boolean;
}): JSX.Element {
  const [code, setCode] = useState(initial?.code ?? '');
  const [displayName, setDisplayName] = useState(initial?.display_name ?? '');
  const [provider, setProvider] = useState(initial?.provider ?? '');
  const [baseUrl, setBaseUrl] = useState(initial?.base_url ?? '');

  const handle = (e: FormEvent): void => {
    e.preventDefault();
    onSubmit({
      code: code.trim(),
      display_name: displayName.trim(),
      provider: provider.trim(),
      base_url: baseUrl.trim() || null,
      credentials: initial?.credentials ?? {},
      settings: initial?.settings ?? {},
      status: initial?.status ?? 'disabled',
    });
  };

  return (
    <form
      onSubmit={handle}
      className="space-y-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Code"
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          disabled={!!initial?.id}
          placeholder="bbmp_311"
          className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm focus:border-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-ink)]"
        />
        <Input
          label="Display name"
          name="display_name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          placeholder="BBMP 311"
          className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm focus:border-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-ink)]"
        />
        <Input
          label="Provider"
          name="provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          required
          placeholder="bbmp / btp / karnataka_uats"
          className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm focus:border-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-ink)]"
        />
        <Input
          label="Base URL"
          name="base_url"
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.bbmp.gov.in"
          className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm focus:border-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-ink)]"
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" loading={busy}>
          {initial?.id ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}

export default function AdminIntegrations(): JSX.Element {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('');
  const [editing, setEditing] = useState<Integration | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Integration | null>(null);

  const list = useIntegrations({ q: q || undefined, status: status || undefined });
  const create = useCreateIntegration();
  const update = useUpdateIntegration();
  const remove = useDeleteIntegration();
  const probe = useProbeIntegration();

  const rows = list.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            Platform / Integrations
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
            Integrations
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            External connectors (BBMP, BTP, UATS, state helpdesks). Credentials are masked on every
            read.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
        >
          New integration
        </Button>
      </header>

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1">
              <Input
                label="Search"
                name="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="code, name, provider"
                className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 pl-10 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-ink)]"
              />
            </div>
            <div>
              <Select
                label="Status"
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                options={[
                  { value: '', label: 'all' },
                  { value: 'active', label: 'active' },
                  { value: 'degraded', label: 'degraded' },
                  { value: 'disabled', label: 'disabled' },
                  { value: 'pending', label: 'pending' },
                ]}
                className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm focus:border-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-ink)]"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {creating ? (
        <IntegrationForm
          busy={create.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={(v) => {
            create.mutate(v, { onSuccess: () => setCreating(false) });
          }}
        />
      ) : null}

      {editing ? (
        <IntegrationForm
          initial={editing}
          busy={update.isPending}
          onCancel={() => setEditing(null)}
          onSubmit={(v) => {
            update.mutate({ id: editing.id, ...v }, { onSuccess: () => setEditing(null) });
          }}
        />
      ) : null}

      <Card className="overflow-hidden p-0">
        {list.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner label="Loading integrations" />
          </div>
        ) : list.isError ? (
          <div className="p-6">
            <ErrorState
              title="Failed to load integrations"
              description="There was a problem fetching integrations."
              error={list.error instanceof Error ? list.error : null}
              action={
                <Button variant="secondary" size="sm" onClick={() => void list.refetch()}>
                  Retry
                </Button>
              }
            />
          </div>
        ) : rows.length === 0 ? (
          <CardBody>
            <EmptyState
              title="No integrations configured"
              description="Connect an external system to get started."
            />
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem]">
              <thead className="bg-[var(--color-canvas)]">
                <tr>
                  <th className="px-5 py-3 text-left text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    Code
                  </th>
                  <th className="px-5 py-3 text-left text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    Name / provider
                  </th>
                  <th className="px-5 py-3 text-left text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    Last health
                  </th>
                  <th className="px-5 py-3 text-right text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {rows.map((i) => (
                  <tr key={i.id}>
                    <td className="px-5 py-3 text-sm font-mono font-medium text-[var(--color-ink)]">
                      {i.code}
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <div className="font-medium text-[var(--color-ink)]">{i.display_name}</div>
                      <div className="text-xs text-[var(--color-text-secondary)]">{i.provider}</div>
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <StatusPill status={i.status} />
                    </td>
                    <td className="px-5 py-3 text-sm tabular-nums text-[var(--color-text-secondary)]">
                      {i.last_check_at ? new Date(i.last_check_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={probe.isPending}
                          onClick={() => probe.mutate(i.id)}
                        >
                          Probe
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditing(i);
                            setCreating(false);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={remove.isPending}
                          onClick={() => setDeleteTarget(i)}
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

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={deleteTarget ? `Delete ${deleteTarget.code}?` : 'Delete integration'}
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
          This action cannot be undone. The integration will be removed permanently.
        </p>
      </Dialog>
    </div>
  );
}
