import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { translate, getCatalog } from '../../messages';

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

describe('CitizenLayout locale support', () => {
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

  it('translates nav keys to kn-IN correctly', () => {
    expect(translate('kn-IN', 'nav.home')).toBe('ಮುಖಪುಟ');
    expect(translate('kn-IN', 'nav.reports')).toBe('ವರದಿಗಳು');
    expect(translate('kn-IN', 'nav.newReport')).toBe('ಹೊಸ ವರದಿ');
    expect(translate('kn-IN', 'nav.account')).toBe('ಖಾತೆ');
    expect(translate('kn-IN', 'citizenServices')).toBe('ನಾಗರಿಕ ಸೇವೆಗಳು');
  });

  it('renders nav from the message catalog (en-IN)', () => {
    renderAt('/citizen');
    const { sidebar } = getNavs();
    expect(within(sidebar).getByText('Home')).toBeTruthy();
    expect(within(sidebar).getByText('Reports')).toBeTruthy();
    expect(within(sidebar).getByText('New report')).toBeTruthy();
    expect(within(sidebar).getByText('Account')).toBeTruthy();
  });

  it('exposes a complete kn-IN catalog', () => {
    const catalog = getCatalog('kn-IN');
    expect(catalog['nav.home']).toBe('ಮುಖಪುಟ');
    expect(catalog['citizenServices']).toBe('ನಾಗರಿಕ ಸೇವೆಗಳು');
    expect(catalog['common.signOut']).toBe('ಸೈನ್ ಔಟ್');
  });
});
