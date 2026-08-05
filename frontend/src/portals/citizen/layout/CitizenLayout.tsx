import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { type JSX } from 'react';
import { Home, FileText, PlusCircle, User, LogOut } from 'lucide-react';
import { useAuth } from '../../../auth/AuthContext';
import { InstallPrompt } from '../../../pwa/InstallPrompt';
import { ToastProvider } from '../components/Toast';
import { cx } from '../../moderator/design/cx';

type CitizenIconName = 'home' | 'reports' | 'add' | 'profile';

const NAV: Array<{
  to: string;
  label: string;
  icon: CitizenIconName;
  end?: boolean;
}> = [
  { to: '/citizen', label: 'Home', icon: 'home', end: true },
  { to: '/citizen/reports', label: 'My Reports', icon: 'reports' },
  { to: '/citizen/submit', label: 'New Report', icon: 'add' },
  { to: '/citizen/profile', label: 'Profile', icon: 'profile' },
];

const iconMap: Record<CitizenIconName, typeof Home> = {
  home: Home,
  reports: FileText,
  add: PlusCircle,
  profile: User,
};

export function CitizenLayout(): JSX.Element {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    void navigate('/');
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 lg:flex">
      {/* Desktop sidebar (lg+) */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-neutral-200 bg-white lg:flex">
        <div className="px-6 py-6">
          <div className="flex items-center gap-3.5">
            <EmblemMark className="h-10 w-10 shrink-0" />
            <div className="min-w-0">
              <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-indigo-700">
                Government of Karnataka
              </div>
              <div className="truncate text-sm font-semibold leading-tight text-neutral-900">
                Civic Intelligence Platform
              </div>
            </div>
          </div>
        </div>

        <nav aria-label="Citizen sections" className="flex-1 px-3 py-4">
          <ul className="space-y-1">
            {NAV.map((n) => {
              const Icon = iconMap[n.icon];
              return (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    end={n.end}
                    className={({ isActive }) =>
                      cx(
                        'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors duration-150',
                        isActive
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
                      )
                    }
                  >
                    <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                    <span>{n.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-neutral-100 px-3 py-4">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-500 transition-colors duration-150 hover:bg-neutral-50 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 border-b border-neutral-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 lg:hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <EmblemMark className="h-9 w-9 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                Government of Karnataka
              </div>
              <div className="truncate text-[13px] font-semibold leading-tight text-neutral-900">
                Civic Intelligence Platform
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="shrink-0 rounded-lg p-2.5 text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Sign Out"
            >
              <LogOut className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        </header>

        {/* Content area */}
        <ToastProvider>
          <main className="w-full flex-1 px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8 lg:py-12 lg:pb-12">
            <div className="mx-auto max-w-5xl">
              <Outlet />
            </div>
          </main>
          <InstallPrompt />
        </ToastProvider>

        {/* Mobile bottom nav */}
        <nav
          aria-label="Citizen sections"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <ul className="mx-auto grid max-w-lg grid-cols-4 items-stretch">
            {NAV.map((n) => {
              const Icon = iconMap[n.icon];
              return (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    end={n.end}
                    className={({ isActive }) =>
                      cx(
                        'flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors duration-150',
                        isActive ? 'text-indigo-700' : 'text-neutral-500',
                      )
                    }
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                    <span className="max-w-full truncate leading-tight">{n.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}

function EmblemMark({ className }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="22" stroke="#312e81" strokeWidth="2" fill="#312e81" />
      <circle cx="24" cy="24" r="16" stroke="#a5b4fc" strokeWidth="1.5" fill="none" />
      <path
        d="M24 10 L26 20 L36 20 L28 26 L30 36 L24 30 L18 36 L20 26 L12 20 L22 20 Z"
        fill="#a5b4fc"
      />
      <circle cx="24" cy="24" r="3" fill="#a5b4fc" />
    </svg>
  );
}
