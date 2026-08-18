import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../../auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'u-1', name: 'Jane Doe', mobile: '+919999999999' },
    token: 'mock-token',
    isAuthenticated: true,
    hasAnyRole: vi.fn(() => false),
    logout: vi.fn(),
    login: vi.fn(),
    loading: false,
  })),
}));

vi.mock('../../../../pwa/InstallPrompt', () => ({
  InstallPrompt: () => null,
}));

vi.mock('../../components/Toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const CitizenLayout = (await import('../CitizenLayout')).CitizenLayout;

describe('CitizenLayout navigation', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  function renderAt(path: string) {
    return render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <CitizenLayout />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  // Both desktop sidebar and mobile bottom nav share the same aria-label
  // "Citizen sections"; return them as a pair.
  function getNavs() {
    const navs = screen.getAllByRole('navigation', { name: 'Citizen sections' });
    const sidebar = navs[0];
    const bottom = navs[1];
    return { sidebar, bottom };
  }

  it('renders the four primary navigation items in the sidebar', () => {
    renderAt('/citizen');
    const { sidebar } = getNavs();
    for (const label of ['Home', 'Reports', 'New report', 'Account']) {
      expect(within(sidebar).getByText(label)).toBeTruthy();
    }
    expect(within(sidebar).queryByText('Settings')).toBeNull();
  });

  it('renders the four primary navigation items in the bottom nav', () => {
    renderAt('/citizen');
    const { bottom } = getNavs();
    for (const label of ['Home', 'Reports', 'New report', 'Account']) {
      expect(within(bottom).getByText(label)).toBeTruthy();
    }
    expect(within(bottom).queryByText('Settings')).toBeNull();
  });
});
