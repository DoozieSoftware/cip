import { useSecurityPolicies, useUpsertSecurityPolicy, type SecurityPolicy } from '../api/client';
import { type JSX } from 'react';
import { Spinner, EmptyState } from '../../moderator/design';
import { useState } from 'react';

export default function AdminSecurityPolicies(): JSX.Element {
  const list = useSecurityPolicies();
  const upsert = useUpsertSecurityPolicy();
  const [editing, setEditing] = useState<SecurityPolicy | null>(null);
  const [draftValue, setDraftValue] = useState<string>('');

  function startEdit(p: SecurityPolicy): void {
    setEditing(p);
    setDraftValue(JSON.stringify(p.value ?? {}, null, 2));
  }

  async function save(): Promise<void> {
    if (editing === null) return;
    let parsed: Record<string, unknown>;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      parsed = JSON.parse(draftValue);
    } catch {
      alert('Value must be valid JSON.');
      return;
    }
    try {
      await upsert.mutateAsync({ key: editing.key, value: parsed, type: editing.type, description: editing.description ?? '' });
      setEditing(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Security policies</h1>
        <p className="text-sm text-slate-600">Database-driven knobs the platform reads at runtime.</p>
      </header>

      {list.isLoading ? (
        <Spinner label="Loading policies" />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState title="No policies" description="Run database/seeders/DatabaseSeeder to install the defaults." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2">Key</th>
                <th className="px-4 py-2">Value</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(list.data ?? []).map((p: SecurityPolicy) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-xs text-slate-900">{p.key}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-600">
                    {JSON.stringify(p.value)}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">{p.type}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="rounded-full bg-fuchsia-50 px-3 py-1 text-xs font-medium text-fuchsia-700 hover:bg-fuchsia-100"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing !== null && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-40 grid place-items-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Edit {editing.key}</h2>
            <p className="mt-1 text-xs text-slate-500">JSON value, e.g. {`{"min": 8}`}</p>
            <textarea
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              rows={8}
              className="mt-3 w-full rounded-md border-slate-300 px-3 py-2 font-mono text-xs shadow-sm focus:border-fuchsia-500 focus:ring-fuchsia-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700">Cancel</button>
              <button type="button" onClick={() => { void save(); }} disabled={upsert.isPending} className="rounded-md bg-fuchsia-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-fuchsia-700 disabled:bg-fuchsia-300">
                {upsert.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
