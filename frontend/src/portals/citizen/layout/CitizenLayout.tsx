import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { type JSX } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { InstallPrompt } from '../../../pwa/InstallPrompt';
import { ToastProvider } from '../components/Toast';
import { cx } from '../../moderator/design/cx';

const NAV = [
  { to: '/citizen', label: 'Home', icon: '🏠', end: true },
  { to: '/citizen/submit', label: 'Report', icon: '📷' },
  { to: '/citizen/reports', label: 'My reports', icon: '📋' },
  { to: '/citizen/notifications', label: 'Updates', icon: '🔔' },
  { to: '/citizen/profile', label: 'Profile', icon: '👤' },
  { to: '/citizen/settings', label: 'Settings', icon: '⚙️' },
];

export function CitizenLayout(): JSX.Element {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-slate-50 lg:flex">
      {/* Desktop sidebar (lg+) */}
      <aside className="hidden w-64 flex-col border-r border-emerald-100 bg-white lg:flex">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-4">
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-sm font-bold text-white">
            CIP
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-900">Civic Reports</div>
            <div className="text-xs text-slate-500">Bengaluru pilot</div>
          </div>
        </div>
        <nav aria-label="Citizen sections" className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="space-y-0.5">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition',
                      isActive
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                        : 'border-transparent text-slate-600 hover:bg-slate-100',
                    )
                  }
                >
                  <span aria-hidden className="text-base">{n.icon}</span>
                  <span>{n.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={() => { logout(); void navigate('/'); }}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header (below lg) */}
        <header className="sticky top-0 z-30 border-b border-emerald-100 bg-white/95 shadow-sm backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span aria-hidden className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-sm font-bold text-white">
                CIP
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-900">Civic Reports</div>
                <div className="text-xs text-slate-500">Bengaluru pilot</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { logout(); void navigate('/'); }}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </header>

        <ToastProvider>
          <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-24 sm:py-10 lg:px-6">
            <Outlet />
          </main>
          <InstallPrompt />
        </ToastProvider>

        {/* Mobile bottom nav (below lg) */}
        <nav aria-label="Citizen sections" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white shadow-lg lg:hidden">
          <ul className="mx-auto flex max-w-5xl items-stretch justify-around">
            {NAV.map((n) => (
              <li key={n.to} className="flex-1">
                <NavLink
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    cx(
                      'flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition',
                      isActive ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-700',
                    )
                  }
                >
                  <span aria-hidden className="text-lg">{n.icon}</span>
                  <span>{n.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
