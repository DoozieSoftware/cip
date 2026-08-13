import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../../auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'u-1', name: 'John Doe', mobile: '+919999999999' },
    token: 'mock-token',
    isAuthenticated: true,
    hasAnyRole: vi.fn(() => false),
    logout: vi.fn(),
    login: vi.fn(),
    loading: false,
  })),
}));

vi.mock('../components/Toast', () => ({
  useToast: vi.fn(() => ({ show: vi.fn() })),
}));

vi.mock('../push/subscribe', () => ({
  pushSupport: vi.fn(() => ({ supported: false })),
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
}));

const SettingsPage = (await import('../SettingsPage')).default;

describe('SettingsPage', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('renders account section', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Mobile')).toBeTruthy();
  });

  it('renders push notifications section', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Push notifications')).toBeTruthy();
  });

  it('renders privacy & legal section', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Privacy & legal')).toBeTruthy();
    expect(screen.getByText('Privacy policy')).toBeTruthy();
    expect(screen.getByText('Terms of use')).toBeTruthy();
  });

  it('renders sign out section', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getAllByText('Sign out').length).toBeGreaterThan(0);
  });

  it('switches the citizen UI to Kannada and persists the choice', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'kn-IN' } });

    expect(screen.getByRole('heading', { name: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು' })).toBeTruthy();
    expect(localStorage.getItem('cip.citizen.locale')).toBe('kn-IN');
    expect(document.documentElement.lang).toBe('kn-IN');
  });
});
