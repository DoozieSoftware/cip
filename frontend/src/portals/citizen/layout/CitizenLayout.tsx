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
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-slate-50">
      <header className="sticky top-0 z-30 border-b border-emerald-100 bg-white/95 shadow-sm backdrop-blur">
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
        <main className="mx-auto max-w-5xl px-4 py-6 pb-24 sm:py-10">
          <Outlet />
        </main>
        <InstallPrompt />
      </ToastProvider>

      <nav aria-label="Citizen sections" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white shadow-lg">
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
  );
}
