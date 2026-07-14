import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { type JSX } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { InstallPrompt } from '../../../pwa/InstallPrompt';
import { ToastProvider } from '../components/Toast';
import { cx } from '../../moderator/design/cx';

type CitizenIconName = 'home' | 'reports' | 'add' | 'updates' | 'profile' | 'settings';

const NAV: Array<{ to: string; label: string; icon: CitizenIconName; end?: boolean; primary?: boolean }> = [
  { to: '/citizen', label: 'Home', icon: 'home', end: true },
  { to: '/citizen/reports', label: 'My reports', icon: 'reports' },
  { to: '/citizen/submit', label: 'New', icon: 'add', primary: true },
  { to: '/citizen/notifications', label: 'Updates', icon: 'updates' },
  { to: '/citizen/profile', label: 'Profile', icon: 'profile' },
  { to: '/citizen/settings', label: 'Settings', icon: 'settings' },
];

export function CitizenLayout(): JSX.Element {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 lg:flex">
      {/* Desktop sidebar (lg+) */}
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-4">
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            CIP
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-900">Civic Reports</div>
            <div className="text-xs text-slate-500">Citizen services</div>
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
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-transparent text-slate-600 hover:bg-slate-100',
                    )
                  }
                >
                  <span aria-hidden className="grid h-5 w-5 place-items-center"><CitizenIcon name={n.icon} /></span>
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
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span aria-hidden className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">
                CIP
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-900">Civic Reports</div>
                <div className="text-xs text-slate-500">Citizen services</div>
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
          <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-32 sm:py-10 lg:px-6">
            <Outlet />
          </main>
          <InstallPrompt />
        </ToastProvider>

        {/* Mobile bottom nav (below lg) */}
        <nav aria-label="Citizen sections" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white lg:hidden">
          <ul className="mx-auto grid max-w-5xl grid-cols-6 items-end">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    cx(
                      'flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[10px] font-medium transition',
                      n.primary ? '-mt-5' : '',
                      isActive ? 'text-blue-700' : 'text-slate-500 hover:text-slate-700',
                    )
                  }
                >
                  <span
                    aria-hidden
                    className={cx(
                      'grid place-items-center text-lg',
                      n.primary
                        ? 'h-12 w-12 rounded-full border-4 border-white bg-blue-600 text-xl text-white shadow-sm'
                        : 'h-6 w-6',
                    )}
                  >
                    <CitizenIcon name={n.icon} />
                  </span>
                  <span className="max-w-full truncate">{n.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

function CitizenIcon({ name }: { name: CitizenIconName }): JSX.Element {
  const paths: Record<CitizenIconName, JSX.Element> = {
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
    reports: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    add: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
    updates: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2L3 14.5l2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 3.1h5l.4-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2.1-1.5c.1-.3.1-.7.1-1Z" /></>,
  };
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
