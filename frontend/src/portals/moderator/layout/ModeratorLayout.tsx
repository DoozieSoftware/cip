import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { type JSX, useState } from 'react';
import {
  IconBuildingCommunity,
  IconClipboardCheck,
  IconFingerprint,
  IconGauge,
  IconLink,
  IconLogout,
  IconReportAnalytics,
  IconRobot,
  IconUser,
} from '@tabler/icons-react';
import { useAuth } from '../../../auth/AuthContext';
import { cx } from '../../../shared/ui/cx';

const NAV: Array<{
  to: string;
  label: string;
  icon: typeof IconGauge;
  end?: boolean;
}> = [
  { to: '/moderator', label: 'Dashboard', icon: IconGauge, end: true },
  { to: '/moderator/queue', label: 'Review complaints', icon: IconClipboardCheck },
  { to: '/moderator/duplicates', label: 'Duplicates', icon: IconLink },
  { to: '/moderator/misrepresentation', label: 'Misrepresentation', icon: IconFingerprint },
  { to: '/moderator/analytics', label: 'Analytics', icon: IconReportAnalytics },
  { to: '/moderator/ai-performance', label: 'AI', icon: IconRobot },
  { to: '/moderator/profile', label: 'Profile', icon: IconUser },
];

const MOBILE_NAV = NAV.slice(0, 5);

export function ModeratorLayout(): JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = () => {
    logout();
    void navigate('/');
  };

  const displayName = user?.name ?? user?.mobile ?? 'Moderator';
  const initials = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f3f2ed] text-[#1d1d1b] lg:flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          aria-hidden
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col transition-transform duration-200 lg:static lg:translate-x-0',
          'border-r border-[#d9d7d0] bg-white text-[#1d1d1b]',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="border-b border-[#e4e2dc] px-5 py-6">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#1d1d1b] text-white">
              <IconBuildingCommunity className="h-5 w-5" stroke={1.7} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-[-0.01em]">CIP India</div>
              <div className="truncate text-xs text-[#777670]">Moderator</div>
            </div>
          </div>
        </div>

        <nav aria-label="Moderator sections" className="flex-1 px-3 py-4">
          <ul className="space-y-1">
            {NAV.map((n) => {
              const Icon = n.icon;
              return (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    end={n.end}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      cx(
                        'flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors duration-150',
                        isActive
                          ? 'bg-[#1d1d1b] text-white'
                          : 'text-[#6f6e69] hover:bg-[#f3f2ed] hover:text-[#1d1d1b]',
                      )
                    }
                  >
                    <Icon className="h-5 w-5 shrink-0" stroke={1.7} />
                    <span>{n.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-[#e4e2dc] px-3 py-4">
          <div className="mb-3 flex items-center gap-3 px-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#efeee9] text-xs font-semibold text-[#1d1d1b]">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{displayName}</div>
              <div className="truncate text-[10px] text-[#85847f]">Moderator</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-[#6f6e69] transition-colors hover:bg-[#f3f2ed] hover:text-[#1d1d1b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b]"
          >
            <IconLogout className="h-4 w-4" stroke={1.7} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 border-b border-[#d9d7d0] bg-[#f3f2ed]/95 backdrop-blur-xl lg:hidden">
          <div className="flex min-h-16 items-center gap-3 px-4">
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#1d1d1b] transition-colors hover:bg-white lg:hidden"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.7}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#1d1d1b] text-white lg:hidden">
              <IconBuildingCommunity className="h-5 w-5" stroke={1.7} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold tracking-[-0.01em]">CIP India</div>
              <div className="truncate text-[11px] text-[#6f6e69]">Moderator</div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#6f6e69] transition-colors hover:bg-white hover:text-[#1d1d1b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b]"
              aria-label="Sign out"
            >
              <IconLogout className="h-5 w-5" stroke={1.7} />
            </button>
          </div>
        </header>

        {/* Content area */}
        <main className="w-full flex-1 px-4 py-7 pb-28 sm:px-6 lg:px-10 lg:py-10 lg:pb-12">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav
          aria-label="Moderator sections"
          className="fixed inset-x-3 bottom-3 z-30 rounded-2xl border border-black/10 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_12px_40px_rgba(29,29,27,0.12)] backdrop-blur-xl lg:hidden"
        >
          <ul className="grid grid-cols-5 items-stretch px-1">
            {MOBILE_NAV.map((n) => {
              const Icon = n.icon;
              return (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    end={n.end}
                    className={({ isActive }) =>
                      cx(
                        'relative flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors',
                        isActive ? 'text-[#1d1d1b]' : 'text-[#85847f]',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className="h-5 w-5" stroke={isActive ? 2.1 : 1.6} />
                        <span className="max-w-full truncate leading-tight">{n.label}</span>
                        {isActive && (
                          <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#1d1d1b]" />
                        )}
                      </>
                    )}
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
