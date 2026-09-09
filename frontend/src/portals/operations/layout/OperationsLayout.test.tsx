import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SessionUser } from '../../../auth/AuthContext';
import { OperationsLayout } from './OperationsLayout';

const mockAuth = vi.hoisted(() => ({ user: null as SessionUser | null }));

vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuth.user,
    hasAnyRole: (roles: string[]) => mockAuth.user?.roles.some((r) => roles.includes(r)) ?? false,
    logout: vi.fn(),
  }),
}));

const mockQueue = vi.hoisted(() => ({ pendingCount: 0 }));

vi.mock('../offline/useOpsQueue', () => ({
  useOpsQueue: () => ({
    items: [],
    pending: Array.from({ length: mockQueue.pendingCount }, (_, i) => ({ id: `q-${i}` })),
    dead: [],
    done: [],
    isOnline: true,
    refresh: vi.fn(),
    drain: vi.fn(),
    remove: vi.fn(),
    clearDone: vi.fn(),
  }),
}));

vi.mock('../components/DepartmentSwitcher', () => ({
  DepartmentSwitcher: () => null,
}));

const drLinenOfficer: SessionUser = {
  id: 'u-field-1',
  name: 'Field Officer',
  mobile: '9999900001',
  email: null,
  roles: ['department_officer'],
  departments: [{ id: 'd-dr', code: 'DR_LINEN', name: 'Dr Linen', is_manager: false }],
};

function renderLayout(initialPath = '/operations'): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/operations" element={<OperationsLayout />}>
            <Route index element={<div>Operations home</div>} />
            <Route path="profile" element={<div>Profile page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Desktop sidebar is first in the DOM, the mobile bottom bar second. */
function mobileNav(): HTMLElement {
  const navs = screen.getAllByRole('navigation', { name: 'Operations sections' });
  expect(navs).toHaveLength(2);
  return navs[1];
}

function desktopNav(): HTMLElement {
  return screen.getAllByRole('navigation', { name: 'Operations sections' })[0];
}

describe('OperationsLayout mobile bottom nav (DR_LINEN)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user = drLinenOfficer;
    mockQueue.pendingCount = 0;
  });

  it('keeps at most five core items: Reviews, Trips, Pickup request, Collections, Profile', () => {
    renderLayout();
    const nav = mobileNav();
    const links = within(nav).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual([
      'Reviews',
      'Trips',
      'Pickup request',
      'Collections',
      'Profile',
    ]);
    expect(links[0]).toHaveAttribute('href', '/operations/textile-collections/review');
    expect(links[1]).toHaveAttribute('href', '/operations/textile-collections/schedule');
    expect(links[2]).toHaveAttribute('href', '/operations/textile-collections/pickup-requests');
    expect(links[3]).toHaveAttribute('href', '/operations/textile-collections/collections');
    expect(links[4]).toHaveAttribute('href', '/operations/profile');
    expect(nav.querySelector('ul')).toHaveClass('grid-cols-5');
  });

  it('moves History, Reupload, Server failures, and Dashboard off the bottom bar', () => {
    renderLayout();
    const nav = mobileNav();

    for (const label of ['History', 'Reupload', 'Server failures', 'Dashboard']) {
      expect(within(nav).queryByRole('link', { name: label })).not.toBeInTheDocument();
    }
  });

  it('keeps every destination in the desktop sidebar', () => {
    renderLayout();
    const nav = desktopNav();
    const names = within(nav)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(names).toEqual([
      '/operations/textile-collections/capacity',
      '/operations/textile-collections/review',
      '/operations/textile-collections/schedule',
      '/operations/textile-collections/pickup-requests',
      '/operations/textile-collections/collections',
      '/operations/textile-collections/centres',
      '/operations/textile-collections/completed',
      '/operations/textile-collections/reuploads',
      '/operations/textile-collections/offline-recovery',
      '/operations/profile',
    ]);
  });

  it('flags the Profile overflow entry while uploads are queued', () => {
    mockQueue.pendingCount = 2;
    renderLayout();

    expect(
      within(mobileNav()).getByRole('link', { name: 'Profile, 2 pending uploads' }),
    ).toHaveAttribute('href', '/operations/profile');
  });

  it('shows a plain Profile entry when nothing is queued', () => {
    renderLayout();

    expect(within(mobileNav()).getByRole('link', { name: 'Profile' })).toBeInTheDocument();
  });
});
