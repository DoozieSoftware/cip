import { useState } from 'react';
import { type JSX } from 'react';
import { useAdminUsers, type AdminUser } from '../api/client';
import { Spinner, EmptyState } from '../../moderator/design';

export default function AdminUsers(): JSX.Element {
  const [q, setQ] = useState<string>('');
  const users = useAdminUsers(q);

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-600">Every account in the platform.</p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, mobile, or email…"
          className="w-72 rounded-md border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-fuchsia-500 focus:ring-fuchsia-500"
        />
      </header>

      {users.isLoading ? (
        <Spinner label="Loading users" />
      ) : (users.data ?? []).length === 0 ? (
        <EmptyState title="No users" description="The platform has no users yet (or none match the search)." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Mobile</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Roles</th>
                <th className="px-4 py-2">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(users.data ?? []).map((u: AdminUser) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-900">{u.name ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-700">{u.mobile}</td>
                  <td className="px-4 py-2 text-slate-700">{u.email ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{u.status ?? 'active'}</span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <span key={r} className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs text-fuchsia-800">{r}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
