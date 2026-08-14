import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import HomePage from '../HomePage';

vi.mock('../../api/client', () => ({
  lifecycleGroup: vi.fn(() => 'open'),
  useCitizenReports: vi.fn(() => ({
    isLoading: false,
    isError: false,
    data: {
      data: [],
      meta: { page: 1, per_page: 100, total: 0, last_page: 1 },
    },
  })),
}));

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(() => true),
}));

vi.mock('../../../../auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'u-1', name: 'Asha Kumar', mobile: '+919999999999' },
  })),
}));

vi.mock('../../offline/queue', () => ({
  getQueue: vi.fn(() => ({ size: vi.fn(() => 0) })),
}));

describe('HomePage i18n', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  function renderPage(): void {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('renders the citizen services label from the catalog', () => {
    renderPage();
    expect(screen.getByText('Citizen services')).toBeInTheDocument();
  });

  it('renders the greeting with the user’s first name', () => {
    renderPage();
    expect(screen.getByText('Good morning, Asha.')).toBeInTheDocument();
  });

  it('renders the home tagline from the catalog', () => {
    renderPage();
    expect(
      screen.getByText(
        'Report an issue, follow department action, and keep one reference for every update.',
      ),
    ).toBeInTheDocument();
  });

  it('renders stats labels from the catalog', () => {
    renderPage();
    for (const label of ['Filed', 'Active', 'Fixed', 'Offline']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('renders the empty-state message from the catalog', () => {
    renderPage();
    expect(screen.getByText('No reports filed yet.')).toBeInTheDocument();
  });

  it('renders the whats-next step titles from the catalog', () => {
    renderPage();
    expect(screen.getByText('Evidence review')).toBeInTheDocument();
    expect(screen.getByText('Department routing')).toBeInTheDocument();
    expect(screen.getByText('Tracked fix')).toBeInTheDocument();
  });
});
