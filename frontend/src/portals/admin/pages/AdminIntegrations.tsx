import { useState, type FormEvent, type JSX } from 'react';
import {
  useIntegrations,
  useCreateIntegration,
  useUpdateIntegration,
  useDeleteIntegration,
  useProbeIntegration,
  type Integration,
} from '../api/client';
import { Spinner } from '../../moderator/design';
import { cx } from '../../moderator/design/cx';

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  degraded: 'bg-amber-100 text-amber-800 border-amber-200',
  disabled: 'bg-slate-200 text-slate-700 border-slate-300',
  pending: 'bg-sky-100 text-sky-800 border-sky-200',
};

function StatusPill({ status }: { status: Integration['status'] }): JSX.Element {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide',
        STATUS_COLOR[status] ?? 'bg-slate-100 text-slate-700 border-slate-200',
      )}
    >
      {status}
    </span>
  );
}

function IntegrationForm({ initial, onSubmit, onCancel, busy }: {
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
    <form onSubmit={handle} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Code</span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            disabled={!!initial?.id}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-100"
            placeholder="bbmp_311"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Display name</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="BBMP 311"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Provider</span>
          <input
            type="text"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="bbmp / btp / karnataka_uats"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Base URL</span>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="https://api.bbmp.gov.in"
          />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-fuchsia-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-fuchsia-700 disabled:opacity-50"
        >
          {busy ? 'Saving…' : initial?.id ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

export default function AdminIntegrations(): JSX.Element {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('');
  const [editing, setEditing] = useState<Integration | null>(null);
  const [creating, setCreating] = useState(false);

  const list = useIntegrations({ q: q || undefined, status: status || undefined });
  const create = useCreateIntegration();
  const update = useUpdateIntegration();
  const remove = useDeleteIntegration();
  const probe = useProbeIntegration();

  const rows = list.data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
        <p className="mt-1 text-sm text-slate-600">
          External connectors (BBMP, BTP, UATS, state helpdesks). Credentials are masked on every read.
        </p>
      </header>

      <section className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="block font-medium text-slate-700">Search</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="code, name, provider"
            className="mt-1 block rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="block font-medium text-slate-700">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 block rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">all</option>
            <option value="active">active</option>
            <option value="degraded">degraded</option>
            <option value="disabled">disabled</option>
            <option value="pending">pending</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => { setCreating(true); setEditing(null); }}
          className="ml-auto rounded-md bg-fuchsia-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-fuchsia-700"
        >
          New integration
        </button>
      </section>

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

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {list.isLoading ? (
          <div className="flex items-center justify-center py-16"><Spinner label="Loading integrations" /></div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No integrations configured.</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Code</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name / provider</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Last health</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((i) => (
                <tr key={i.id}>
                  <td className="px-5 py-3 text-sm font-mono text-slate-700">{i.code}</td>
                  <td className="px-5 py-3 text-sm">
                    <div className="font-medium text-slate-900">{i.display_name}</div>
                    <div className="text-xs text-slate-500">{i.provider}</div>
                  </td>
                  <td className="px-5 py-3 text-sm"><StatusPill status={i.status} /></td>
                  <td className="px-5 py-3 text-sm tabular-nums text-slate-700">
                    {i.last_check_at ? new Date(i.last_check_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button type="button" disabled={probe.isPending} onClick={() => probe.mutate(i.id)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50">Probe</button>
                      <button type="button" onClick={() => { setEditing(i); setCreating(false); }} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50">Edit</button>
                      <button type="button" disabled={remove.isPending} onClick={() => { if (confirm(`Delete ${i.code}?`)) remove.mutate(i.id); }} className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-800 hover:bg-rose-100 disabled:opacity-50">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
