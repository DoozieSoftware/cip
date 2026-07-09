import { useState } from 'react';
import { type JSX } from 'react';
import { useAuditLogs, type AuditLog } from '../api/client';
import { Spinner, EmptyState } from '../../moderator/design';

export default function AdminAuditLog(): JSX.Element {
  const [action, setAction] = useState<string>('');
  const [entity, setEntity] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const list = useAuditLogs({ action: action || undefined, entity: entity || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Audit log</h1>
        <p className="text-sm text-slate-600">Search who-did-what across the platform.</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="action" className="rounded-md border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-fuchsia-500 focus:ring-fuchsia-500" />
        <input value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="entity" className="rounded-md border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-fuchsia-500 focus:ring-fuchsia-500" />
        <input type="datetime-local" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-md border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-fuchsia-500 focus:ring-fuchsia-500" />
        <input type="datetime-local" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-md border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-fuchsia-500 focus:ring-fuchsia-500" />
      </div>

      {list.isLoading ? (
        <Spinner label="Loading audit" />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState title="No entries" description="Try widening the filters or pick a different action/entity." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Entity</th>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(list.data ?? []).map((row: AuditLog) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-xs text-slate-500">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-900">{row.action}</td>
                  <td className="px-4 py-2 text-xs text-slate-700">{row.entity ?? '—'}{row.entity_id ? ` · ${row.entity_id.slice(0, 8)}…` : ''}</td>
                  <td className="px-4 py-2 text-xs text-slate-700">{row.user_id?.slice(0, 8) ?? '—'}{row.roles?.length ? ` · ${row.roles.join(', ')}` : ''}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{row.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
