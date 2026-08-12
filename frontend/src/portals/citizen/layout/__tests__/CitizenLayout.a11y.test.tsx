import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('CitizenLayout accessibility', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  function renderLayout(path = '/citizen') {
    return render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <CitizenLayout />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('renders a skip link to main content', () => {
    renderLayout();
    const skipLink = screen.getByText('Skip to main content');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink.tagName).toBe('A');
    expect(skipLink.getAttribute('href')).toBe('#cip-main-content');
  });

  it('renders the main content region with the skip-link target id', () => {
    renderLayout();
    const main = document.getElementById('cip-main-content');
    expect(main).not.toBeNull();
    expect(main?.tagName).toBe('MAIN');
  });

  it('makes the main content region focusable for skip-link landing', () => {
    renderLayout();
    const main = document.getElementById('cip-main-content');
    expect(main?.getAttribute('tabindex')).toBe('-1');
  });
});
