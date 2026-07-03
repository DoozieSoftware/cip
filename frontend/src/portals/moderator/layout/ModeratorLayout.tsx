import { type ReactNode } from 'react';
import { SidebarLayout, type SidebarNavItem } from '../design';

const NAV: SidebarNavItem[] = [
  { to: '/moderator', label: 'Dashboard', end: true, icon: '📊' },
  { to: '/moderator/queue', label: 'Review Queue', icon: '📥' },
  { to: '/moderator/duplicates', label: 'Duplicates', icon: '🔗' },
  { to: '/moderator/fraud', label: 'Fraud', icon: '🚨' },
  { to: '/moderator/analytics', label: 'Analytics', icon: '📈' },
  { to: '/moderator/ai-performance', label: 'AI Performance', icon: '🤖' },
];

const SHORTCUTS: ReactNode = (
  <>
    v1.0 — keyboard:{' '}
    <kbd className="rounded bg-slate-100 px-1">A</kbd> approve ·{' '}
    <kbd className="rounded bg-slate-100 px-1">R</kbd> reject ·{' '}
    <kbd className="rounded bg-slate-100 px-1">M</kbd> merge ·{' '}
    <kbd className="rounded bg-slate-100 px-1">E</kbd> escalate ·{' '}
    <kbd className="rounded bg-slate-100 px-1">N</kbd> next
  </>
);

export function ModeratorLayout() {
  return (
    <SidebarLayout
      brand="CIP"
      brandSubtitle="Moderator Portal"
      brandColor="brand"
      accent="brand"
      nav={NAV}
      user={{ name: 'Moderator', roleLabel: 'moderator' }}
      keyboardShortcuts={SHORTCUTS}
    />
  );
}
