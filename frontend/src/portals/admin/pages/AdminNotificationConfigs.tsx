import { useState, type FormEvent, type JSX } from 'react';
import {
  useNotificationConfigs,
  useUpsertNotificationConfig,
  useDeleteNotificationConfig,
  type NotificationConfig,
} from '../api/client';
import { Button, Dialog, Spinner } from '../../moderator/design';

const CHANNELS: NotificationConfig['channel'][] = ['mail', 'sms', 'push', 'webhook'];

function ConfigForm({ busy, onCancel, onSubmit }: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: Partial<NotificationConfig>) => void;
}): JSX.Element {
  const [channel, setChannel] = useState<NotificationConfig['channel']>('mail');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [credentials, setCredentials] = useState('{\n  "host": "smtp.example.in"\n}');
  const [tries, setTries] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    try {
      const parsed = JSON.parse(credentials) as unknown;
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length === 0) {
        setError('Credentials must be a non-empty JSON object.');
        return;
      }
      setError(null);
      onSubmit({
        channel,
        code: code.trim(),
        display_name: displayName.trim(),
        credentials: parsed as Record<string, unknown>,
        retry_policy: { tries, backoff: [30, 120, 600].slice(0, tries) },
        settings: {},
        per_locale_defaults: {},
        active: false,
      });
    } catch {
      setError('Credentials must be valid JSON.');
    }
  };

  return <form onSubmit={submit} className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm"><span className="font-medium text-slate-700">Channel</span><select value={channel} onChange={(event) => setChannel(event.target.value as NotificationConfig['channel'])} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2">{CHANNELS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="text-sm"><span className="font-medium text-slate-700">Code</span><input value={code} onChange={(event) => setCode(event.target.value)} required pattern="[a-z0-9_-]+" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" /></label>
      <label className="text-sm"><span className="font-medium text-slate-700">Display name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" /></label>
      <label className="text-sm"><span className="font-medium text-slate-700">Retry attempts</span><input type="number" min={1} max={10} value={tries} onChange={(event) => setTries(Number(event.target.value))} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" /></label>
    </div>
    <label className="block text-sm"><span className="font-medium text-slate-700">Credentials (JSON)</span><textarea value={credentials} onChange={(event) => setCredentials(event.target.value)} rows={6} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs" /></label>
    {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
    <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Create config'}</Button></div>
  </form>;
}

function ChannelPill({ channel, active }: { channel: NotificationConfig['channel']; active: boolean }): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${
        active ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-200 text-slate-700 border-slate-300'
      }`}
    >
      {channel}
    </span>
  );
}

export default function AdminNotificationConfigs(): JSX.Element {
  const [channel, setChannel] = useState<string>('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const list = useNotificationConfigs({ channel: channel || undefined, active: activeOnly || undefined });
  const upsert = useUpsertNotificationConfig();
  const remove = useDeleteNotificationConfig();

  const rows = list.data ?? [];

  const handleToggle = (cfg: NotificationConfig): void => {
    upsert.mutate({ id: cfg.id, channel: cfg.channel, code: cfg.code, display_name: cfg.display_name, active: !cfg.active, credentials: cfg.credentials, retry_policy: cfg.retry_policy });
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Notification configs</h1>
        <p className="mt-1 text-sm text-slate-600">Channel credentials, retry policy, and per-locale template defaults. Credentials are masked on every read.</p></div>
        <Button onClick={() => setCreating(true)}>+ New config</Button>
      </header>

      <section className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block font-medium text-slate-700">Channel</span>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="mt-1 block rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">all</option>
            {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <span className="font-medium text-slate-700">active only</span>
        </label>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {list.isLoading ? (
          <div className="flex items-center justify-center py-16"><Spinner label="Loading configs" /></div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No notification configs.</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Channel</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Code / name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Active</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Retry</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 text-sm"><ChannelPill channel={c.channel} active={c.active} /></td>
                  <td className="px-5 py-3 text-sm">
                    <div className="font-mono text-xs text-slate-500">{c.code}</div>
                    <div className="font-medium text-slate-900">{c.display_name}</div>
                  </td>
                  <td className="px-5 py-3 text-sm">
                    <button
                      type="button"
                      onClick={() => handleToggle(c)}
                      disabled={upsert.isPending}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${c.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      aria-pressed={c.active}
                      aria-label={`Toggle ${c.display_name}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${c.active ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-700">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                      {c.retry_policy?.tries ?? '—'} attempts · {JSON.stringify(c.retry_policy?.backoff ?? [])}
                    </code>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      disabled={remove.isPending}
                      onClick={() => { if (confirm(`Delete ${c.code}?`)) remove.mutate(c.id); }}
                      className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <Dialog open={creating} onClose={() => setCreating(false)} title="New notification config">
        <ConfigForm busy={upsert.isPending} onCancel={() => setCreating(false)} onSubmit={(input) => upsert.mutate(input, { onSuccess: () => setCreating(false) })} />
        {upsert.isError ? <p role="alert" className="mt-2 text-sm text-rose-700">{upsert.error.message}</p> : null}
      </Dialog>
    </div>
  );
}
