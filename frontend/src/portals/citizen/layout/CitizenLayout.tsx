import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { type JSX, type TouchEvent, useRef, useState } from 'react';
import {
  IconBuildingCommunity,
  IconFileDescription,
  IconHome,
  IconLogout,
  IconPlus,
  IconRefresh,
  IconUser,
} from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../auth/AuthContext';
import { InstallPrompt } from '../../../pwa/InstallPrompt';
import { ToastProvider } from '../components/Toast';
import { cx } from '../../../shared/ui/cx';

const NAV: Array<{
  to: string;
  label: string;
  icon: typeof IconHome;
  end?: boolean;
}> = [
  { to: '/citizen', label: 'Home', icon: IconHome, end: true },
  { to: '/citizen/reports', label: 'Reports', icon: IconFileDescription },
  { to: '/citizen/submit', label: 'New report', icon: IconPlus },
  { to: '/citizen/profile', label: 'Account', icon: IconUser },
];

export function CitizenLayout(): JSX.Element {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    void navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#f3f2ed] text-[#1d1d1b] lg:flex">
      {/* Desktop sidebar (lg+) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#deddd7] bg-[#faf9f6] lg:flex">
        <div className="border-b border-[#e6e4de] px-6 py-7">
          <div className="flex items-center gap-3.5">
            <BrandMark />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-[-0.01em]">CIP Karnataka</div>
              <div className="truncate text-xs text-[#74736f]">Citizen services</div>
            </div>
          </div>
        </div>

        <nav aria-label="Citizen sections" className="flex-1 px-3 py-4">
          <ul className="space-y-1">
            {NAV.map((n) => {
              const Icon = n.icon;
              return (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    end={n.end}
                    className={({ isActive }) =>
                      cx(
                        'flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors duration-150',
                        isActive
                          ? 'bg-[#1d1d1b] text-white'
                          : 'text-[#686762] hover:bg-[#efeee9] hover:text-[#1d1d1b]',
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

        <div className="border-t border-neutral-100 px-3 py-4">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-[#686762] transition-colors hover:bg-[#efeee9] hover:text-[#1d1d1b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b] focus-visible:ring-offset-2"
          >
            <IconLogout className="h-4 w-4" stroke={1.7} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 border-b border-[#e4e2dc] bg-[#faf9f6]/95 backdrop-blur-xl lg:hidden">
          <div className="flex min-h-16 items-center gap-3 px-4">
            <BrandMark />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold tracking-[-0.01em]">CIP Karnataka</div>
              <div className="truncate text-[11px] text-[#777670]">Citizen services</div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#686762] transition-colors hover:bg-[#efeee9] hover:text-[#1d1d1b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b]"
              aria-label="Sign out"
            >
              <IconLogout className="h-5 w-5" stroke={1.7} />
            </button>
          </div>
        </header>

        {/* Content area */}
        <ToastProvider>
          <PullToRefresh>
            <main className="w-full flex-1 px-4 py-7 pb-28 sm:px-6 lg:px-10 lg:py-10 lg:pb-12">
              <Outlet />
            </main>
          </PullToRefresh>
          <InstallPrompt />
        </ToastProvider>

        {/* Mobile bottom nav */}
        <nav
          aria-label="Citizen sections"
          className="fixed inset-x-3 bottom-3 z-30 rounded-2xl border border-black/10 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_12px_40px_rgba(29,29,27,0.16)] backdrop-blur-xl lg:hidden"
        >
          <ul className="grid grid-cols-4 items-stretch px-1">
            {NAV.map((n) => {
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

function BrandMark(): JSX.Element {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#1d1d1b] text-white">
      <IconBuildingCommunity className="h-5 w-5" stroke={1.7} />
    </span>
  );
}

function PullToRefresh({ children }: { children: JSX.Element }): JSX.Element {
  const queryClient = useQueryClient();
  const startY = useRef<number | null>(null);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = (event: TouchEvent<HTMLDivElement>): void => {
    if (window.scrollY === 0) startY.current = event.touches[0]?.clientY ?? null;
  };

  const onTouchMove = (event: TouchEvent<HTMLDivElement>): void => {
    if (startY.current === null || window.scrollY > 0) return;
    const delta = Math.max(0, (event.touches[0]?.clientY ?? startY.current) - startY.current);
    setDistance(Math.min(72, delta * 0.45));
  };

  const onTouchEnd = (): void => {
    const shouldRefresh = distance >= 48;
    startY.current = null;

    if (!shouldRefresh) {
      setDistance(0);
      return;
    }

    setRefreshing(true);
    setDistance(48);
    void queryClient.invalidateQueries().finally(() => {
      setRefreshing(false);
      setDistance(0);
    });
  };

  return (
    <div
      className="relative flex flex-1 flex-col"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        aria-live="polite"
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-center overflow-hidden text-xs text-[#6f6e69] transition-[height]"
        style={{ height: distance }}
      >
        <IconRefresh className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} stroke={1.7} />
        {refreshing ? 'Refreshing' : distance >= 48 ? 'Release to refresh' : 'Pull to refresh'}
      </div>
      <div
        className="flex flex-1 flex-col transition-transform"
        style={{ transform: `translateY(${distance}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
