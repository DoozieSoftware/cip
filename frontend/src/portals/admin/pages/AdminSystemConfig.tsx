import { useMemo, useState, type FormEvent, type JSX } from 'react';
import {
  useSettings,
  useUpdateSetting,
  useCreateSetting,
  useDeleteSetting,
  type Setting,
} from '../api/client';
import { Spinner } from '../../moderator/design';
import { cx } from '../../moderator/design/cx';

const TYPES: Setting['type'][] = ['string', 'int', 'bool', 'json', 'datetime'];

/**
 * T-M12-028 — System configuration console.
 *
 * Lists every non-flag, non-feature setting on a single
 * page. The dedicated pages (security policies, feature
 * flags, media storage, retention) own the curated keys;
 * this page is the catch-all for everything else
 * (rate limits, locale defaults, observability toggles,
 * etc.).
 */

const NON_SYSTEM_KEYS = [
  'retention.',
  'media_storage',
  'app_config',
  'feature_flag',
  'ai.vision.',
  'notification.',
];

function isSystemKey(key: string): boolean {
  return !NON_SYSTEM_KEYS.some((prefix) => key.startsWith(prefix));
}

function coerceValue(raw: string, type: Setting['type']): unknown {
  if (type === 'json') {
    try { return JSON.parse(raw) as unknown; } catch { return raw; }
  }
  if (type === 'int') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (type === 'bool') {
    return raw === 'true' || raw === '1';
  }
  return raw;
}

function SettingRow({ s, busy, onSave, onDelete }: {
  s: Setting;
  busy: boolean;
  onSave: (patch: Partial<Setting>) => void;
  onDelete: () => void;
}): JSX.Element {
  const [value, setValue] = useState<string>(typeof s.value === 'string' ? s.value : JSON.stringify(s.value));
  return (
    <tr>
      <td className="px-5 py-3 text-sm font-mono text-slate-700">{s.key}</td>
      <td className="px-5 py-3 text-sm">
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{s.type}</code>
        <span className="ml-2 text-xs text-slate-500">{s.is_public ? 'public' : 'private'}</span>
      </td>
      <td className="px-5 py-3 text-sm">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={busy}
          className="block w-full rounded-md border border-slate-300 px-2 py-1 font-mono text-xs"
        />
      </td>
      <td className="px-5 py-3 text-sm text-slate-600">{s.description ?? '—'}</td>
      <td className="px-5 py-3 text-right">
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave({ key: s.key, value: coerceValue(value, s.type), type: s.type })}
            className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDelete()}
            className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-800 hover:bg-rose-100 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminSystemConfig(): JSX.Element {
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [draftKey, setDraftKey] = useState('');
  const [draftType, setDraftType] = useState<Setting['type']>('string');
  const [draftValue, setDraftValue] = useState('');
  const [draftDescription, setDraftDescription] = useState('');

  const list = useSettings(q);
  const create = useCreateSetting();
  const update = useUpdateSetting();
  const remove = useDeleteSetting();

  const rows = useMemo(() => {
    const all = list.data ?? [];
    return all.filter((s) => isSystemKey(s.key)).sort((a, b) => a.key.localeCompare(b.key));
  }, [list.data]);

  const handleCreate = (e: FormEvent): void => {
    e.preventDefault();
    let parsed: unknown = draftValue;
    if (draftType === 'json') {
      try { parsed = JSON.parse(draftValue); } catch { parsed = draftValue; }
    } else if (draftType === 'int') {
      parsed = Number(draftValue);
    } else if (draftType === 'bool') {
      parsed = draftValue === 'true' || draftValue === '1';
    }
    create.mutate(
      { key: draftKey.trim(), value: parsed, type: draftType, description: draftDescription.trim() || null, is_public: false },
      { onSuccess: () => { setCreating(false); setDraftKey(''); setDraftValue(''); setDraftDescription(''); } },
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System configuration</h1>
          <p className="mt-1 text-sm text-slate-600">
            Generic key/value settings. The dedicated pages own retention, media storage, security policies, and feature flags.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((c) => !c)}
          className={cx(
            'rounded-md px-3 py-1.5 text-sm font-medium',
            creating ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50' : 'bg-fuchsia-600 text-white hover:bg-fuchsia-700',
          )}
        >
          {creating ? 'Cancel' : 'New setting'}
        </button>
      </header>

      {creating ? (
        <form onSubmit={handleCreate} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium text-slate-700">Key</span>
              <input type="text" value={draftKey} onChange={(e) => setDraftKey(e.target.value)} required className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 font-mono text-xs" placeholder="limits.upload.per_hour" />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">Type</span>
              <select value={draftType} onChange={(e) => setDraftType(e.target.value as Setting['type'])} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Value</span>
              <input type="text" value={draftValue} onChange={(e) => setDraftValue(e.target.value)} required className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 font-mono text-xs" />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Description</span>
              <input type="text" value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
            </label>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={create.isPending} className="rounded-md bg-fuchsia-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-fuchsia-700 disabled:opacity-50">
              {create.isPending ? 'Saving…' : 'Create setting'}
            </button>
          </div>
        </form>
      ) : null}

      <section className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="block font-medium text-slate-700">Search</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="key prefix or q=…" className="mt-1 block rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </label>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {list.isLoading ? (
          <div className="flex items-center justify-center py-16"><Spinner label="Loading settings" /></div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No system settings.</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Key</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Type / visibility</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Value</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Description</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((s) => (
                <SettingRow
                  key={s.id}
                  s={s}
                  busy={create.isPending || update.isPending || remove.isPending}
                  onSave={(patch) => update.mutate(patch as Partial<Setting> & { key: string })}
                  onDelete={() => { if (confirm(`Delete ${s.key}?`)) remove.mutate(s.id); }}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
