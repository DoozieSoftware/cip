import { NavLink } from 'react-router-dom';
import { type JSX } from 'react';
import { cx } from '../../moderator/design/cx';

const NAV = [
  { to: '/citizen', label: 'Home', icon: '⌂', end: true },
  { to: '/citizen/submit', label: 'Report', icon: '◎' },
  { to: '/citizen/reports', label: 'Reports', icon: '▤' },
  { to: '/citizen/notifications', label: 'Alerts', icon: '◉' },
  { to: '/citizen/profile', label: 'Profile', icon: '□' },
];

/**
 * Mobile-first bottom navigation. Stays fixed to the bottom
 * of the viewport on small screens; collapses into a
 * horizontal top bar on >= sm viewports so the citizen
 * has parity with the other portals.
 */
export function BottomNav(): JSX.Element {
  return (
    <nav
      aria-label="Citizen sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.04)] sm:static sm:border-b sm:border-t-0 sm:shadow-none"
    >
      <ul className="mx-auto flex max-w-3xl items-stretch justify-between sm:max-w-7xl sm:gap-1">
        {NAV.map((n) => (
          <li key={n.to} className="flex-1">
            <NavLink
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cx(
                  'flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium transition sm:h-auto sm:flex-row sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm',
                  isActive
                    ? 'text-blue-700 sm:border-b-2 sm:border-blue-600'
                    : 'text-slate-500 hover:text-slate-900 sm:border-b-2 sm:border-transparent',
                )
              }
            >
              <span aria-hidden className="text-lg sm:text-base">{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
