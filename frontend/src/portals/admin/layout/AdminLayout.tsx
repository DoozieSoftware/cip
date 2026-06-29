import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { type JSX } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { cx } from '../../moderator/design/cx';

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true, icon: '📊' },
  { to: '/admin/users', label: 'Users', icon: '👥' },
  { to: '/admin/roles', label: 'Roles & perms', icon: '🛡️' },
  { to: '/admin/report-types', label: 'Report types', icon: '🏷️' },
  { to: '/admin/security-policies', label: 'Security', icon: '🔒' },
  { to: '/admin/feature-flags', label: 'Feature flags', icon: '🚩' },
  { to: '/admin/health', label: 'Health', icon: '💓' },
  { to: '/admin/scheduler', label: 'Scheduler', icon: '⏱️' },
  { to: '/admin/integrations', label: 'Integrations', icon: '🔌' },
  { to: '/admin/storage', label: 'Storage', icon: '💾' },
  { to: '/admin/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/admin/ai', label: 'AI', icon: '🤖' },
  { to: '/admin/routing-rules', label: 'Routing', icon: '🧭' },
  { to: '/admin/workflows', label: 'Workflows', icon: '🔀' },
  { to: '/admin/audit', label: 'Audit log', icon: '📜' },
];

export function AdminLayout(): JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid h-9 w-9 place-items-center rounded-xl bg-fuchsia-600 text-sm font-bold text-white">SA</span>
            <div>
              <div className="text-sm font-semibold text-slate-900">Super Admin</div>
              <div className="text-xs text-slate-500">Platform configuration</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-600 sm:inline">
              {user?.name ?? user?.mobile ?? '—'} · <span className="rounded bg-fuchsia-100 px-1.5 py-0.5 text-fuchsia-700">super_admin</span>
            </span>
            <button type="button" onClick={() => { void navigate('/'); }} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Home</button>
            <button type="button" onClick={() => { logout(); void navigate('/'); }} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Sign out</button>
          </div>
        </div>
        <nav aria-label="Admin sections" className="mx-auto max-w-7xl px-6">
          <ul className="flex flex-wrap gap-1 overflow-x-auto border-b border-transparent">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    cx(
                      'inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition',
                      isActive
                        ? 'border-fuchsia-600 text-fuchsia-700'
                        : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900',
                    )
                  }
                >
                  <span aria-hidden>{n.icon}</span>
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
