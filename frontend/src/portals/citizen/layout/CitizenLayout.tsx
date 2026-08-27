import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { type JSX, type TouchEvent, useEffect, useRef, useState } from 'react';
import {
  IconBuildingCommunity,
  IconFileDescription,
  IconHanger,
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
import { useMessages, type MessageKey } from '../messages';
import { trackProductEvent } from '../../../shared/analytics';

const NAV: Array<{
  to: string;
  label: MessageKey;
  icon: typeof IconHome;
  end?: boolean;
}> = [
  { to: '/citizen', label: 'nav.home', icon: IconHome, end: true },
  { to: '/citizen/reports', label: 'nav.reports', icon: IconFileDescription },
  { to: '/citizen/submit', label: 'nav.newReport', icon: IconPlus },
  // Partner pickup booking — kept visually distinct from the complaint flow
  // (booking a service vs reporting a dumped-waste problem).
  { to: '/citizen/textile-collections', label: 'nav.pickup', icon: IconHanger },
  { to: '/citizen/profile', label: 'nav.account', icon: IconUser },
];

export function CitizenLayout(): JSX.Element {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useMessages();

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const marker = 'cip.telemetry.reduced-motion.v1';
    try {
      if (window.sessionStorage.getItem(marker) === '1') return;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      trackProductEvent('accessibility_preference_changed', {
        preference: 'reduced_motion',
        value: reduced ? 'enabled' : 'disabled',
      });
      window.sessionStorage.setItem(marker, '1');
    } catch {
      // Private browsing may deny sessionStorage; telemetry remains best effort.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof performance === 'undefined') return;
    const entry = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (!entry || entry.loadEventEnd <= 0) return;
    const duration = entry.loadEventEnd - entry.startTime;
    const bucket = duration < 1000 ? 'under_1s' : duration < 3000 ? '1_to_3s' : 'over_3s';
    trackProductEvent('performance_metric', { surface: 'citizen_shell', load_bucket: bucket });
  }, []);

  const handleSignOut = () => {
    logout();
    void navigate('/');
  };

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-[var(--color-canvas)] text-[var(--color-ink)] lg:flex">
      <a
        href="#cip-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[var(--color-ink)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:outline-none focus:ring-2 focus:ring-white"
      >
        {t('nav.skipToContent')}
      </a>

      {/* Desktop sidebar (lg+) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#deddd7] bg-[#faf9f6] lg:flex">
        <div className="border-b border-[#e6e4de] px-6 py-7">
          <div className="flex items-center gap-3.5">
            <BrandMark />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-[-0.01em]">CIP India</div>
              <div className="truncate text-xs text-[#74736f]">{t('citizenServices')}</div>
            </div>
          </div>
        </div>

        <nav aria-label={t('nav.sections')} className="flex-1 px-3 py-4">
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
                          ? 'bg-white text-[var(--color-ink)] shadow-sm ring-1 ring-black/10'
                          : 'text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-ink)]',
                      )
                    }
                  >
                    <Icon className="h-5 w-5 shrink-0" stroke={1.7} />
                    <span>{t(n.label)}</span>
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
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-2"
          >
            <IconLogout className="h-4 w-4" stroke={1.7} />
            {t('common.signOut')}
          </button>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 border-b border-[var(--color-border-subtle)] bg-[#faf9f6]/95 backdrop-blur-xl lg:hidden">
          <div className="flex min-h-16 items-center gap-3 px-4">
            <BrandMark />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold tracking-[-0.01em]">CIP India</div>
              <div className="truncate text-[11px] text-[var(--color-text-subtle)]">
                {t('citizenServices')}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
              aria-label={t('common.signOut')}
            >
              <IconLogout className="h-5 w-5" stroke={1.7} />
            </button>
          </div>
        </header>

        {/* Content area */}
        <ToastProvider>
          <PullToRefresh>
            <main
              id="cip-main-content"
              tabIndex={-1}
              className="min-w-0 w-full flex-1 overflow-x-clip px-4 py-7 pb-28 focus:outline-none sm:px-6 lg:px-10 lg:py-10 lg:pb-12"
            >
              <Outlet />
            </main>
          </PullToRefresh>
          <InstallPrompt />
        </ToastProvider>

        {/* Mobile bottom nav */}
        <nav
          aria-label={t('nav.sections')}
          className="fixed inset-x-3 bottom-3 z-30 rounded-2xl border border-black/10 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_12px_40px_rgba(29,29,27,0.16)] backdrop-blur-xl lg:hidden"
        >
          {/* Columns follow NAV.length so adding an item can never wrap the
              last entry onto a second row inside this fixed-bottom pill. */}
          <ul
            className="grid items-stretch px-1"
            style={{ gridTemplateColumns: `repeat(${NAV.length}, minmax(0, 1fr))` }}
          >
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
                        isActive ? 'text-[var(--color-ink)]' : 'text-[var(--color-text-tertiary)]',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className="h-5 w-5" stroke={isActive ? 2.1 : 1.6} />
                        <span className="max-w-full truncate leading-tight">{t(n.label)}</span>
                        {isActive && (
                          <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--color-ink)]" />
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
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--color-ink)] text-white">
      <IconBuildingCommunity className="h-5 w-5" stroke={1.7} />
    </span>
  );
}

function PullToRefresh({ children }: { children: JSX.Element }): JSX.Element {
  const { t } = useMessages();
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
      className="relative flex min-w-0 flex-1 flex-col"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        aria-live="polite"
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-center overflow-hidden text-xs text-[var(--color-text-secondary)] transition-[height]"
        style={{ height: distance }}
      >
        <IconRefresh className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} stroke={1.7} />
        {refreshing
          ? t('pullToRefresh.refreshing')
          : distance >= 48
            ? t('pullToRefresh.releaseToRefresh')
            : t('pullToRefresh.pullToRefresh')}
      </div>
      <div
        className="flex min-w-0 flex-1 flex-col transition-transform"
        style={{ transform: `translateY(${distance}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
