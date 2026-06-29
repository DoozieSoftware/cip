import { useAdminRoles, useAdminPermissions, type AdminRole } from '../api/client';
import { type JSX } from 'react';
import { Spinner, EmptyState } from '../../moderator/design';

export default function AdminRoles(): JSX.Element {
  const roles = useAdminRoles();
  const perms = useAdminPermissions();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Roles &amp; permissions</h1>
        <p className="text-sm text-slate-600">Read-only catalogue for the demo. Edit via the backend / OpenAPI in the next iteration.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Roles</h2>
          {roles.isLoading ? <Spinner label="Loading roles" /> : (roles.data ?? []).length === 0 ? (
            <EmptyState title="No roles" />
          ) : (
            <ul className="mt-3 space-y-2">
              {(roles.data ?? []).map((r: AdminRole) => (
                <li key={String(r.id)} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">{r.name}</span>
                    {r.protected && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">protected</span>}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{r.permissions.length} permission(s) · guard: {r.guard_name}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.permissions.slice(0, 6).map((p) => (
                      <span key={p} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">{p}</span>
                    ))}
                    {r.permissions.length > 6 && (
                      <span className="text-xs text-slate-500">+ {r.permissions.length - 6} more</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Permissions</h2>
          {perms.isLoading ? <Spinner label="Loading permissions" /> : (perms.data ?? []).length === 0 ? (
            <EmptyState title="No permissions" />
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-1.5">
              {(perms.data ?? []).map((p) => (
                <li key={String(p.id)} className="rounded bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700">{p.name}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
