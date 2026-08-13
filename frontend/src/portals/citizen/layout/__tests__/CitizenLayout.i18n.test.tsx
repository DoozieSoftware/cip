import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

describe('CitizenLayout i18n', () => {
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

  function getNavs() {
    const navs = screen.getAllByRole('navigation', { name: 'Citizen sections' });
    return { sidebar: navs[0], bottom: navs[1] };
  }

  it('renders nav labels from the message catalog (en-IN defaults)', () => {
    renderAt('/citizen');
    const { sidebar } = getNavs();
    for (const label of ['Home', 'Reports', 'New report', 'Account']) {
      expect(within(sidebar).getByText(label)).toBeTruthy();
    }
  });

  it('renders Citizen services brand label from the catalog', () => {
    renderAt('/citizen');
    expect(screen.getAllByText('Citizen services').length).toBeGreaterThan(0);
  });

  it('renders the sign-out button label from the catalog', () => {
    renderAt('/citizen');
    expect(screen.getAllByRole('button', { name: 'Sign out' }).length).toBeGreaterThan(0);
  });
});
