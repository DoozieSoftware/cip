import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const mutateMock = vi.fn();

vi.mock('../../api/client', () => ({
  useSettings: vi.fn(),
  useUpdateSetting: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
  useCreateSetting: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
  useDeleteSetting: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
}));

 
const { useSettings } = await import('../../api/client');
const AdminDataRetention = (await import('../AdminDataRetention')).default;

const ROWS = [
  { id: 's1', key: 'retention.media.days', value: 90, type: 'int' as const, description: 'Media retention', is_public: false, created_at: null, updated_at: '2026-06-29T10:00:00Z' },
  { id: 's2', key: 'retention.audit.days', value: 365, type: 'int' as const, description: 'Audit log retention', is_public: false, created_at: null, updated_at: null },
  { id: 's3', key: 'retention.backup.days', value: 30, type: 'int' as const, description: null, is_public: false, created_at: null, updated_at: null },
  { id: 's4', key: 'unrelated.key', value: 'foo', type: 'string' as const, description: null, is_public: true, created_at: null, updated_at: null },
];

describe('AdminDataRetention (T-M12-027)', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    mutateMock.mockClear();
    (useSettings as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: ROWS, isLoading: false });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminDataRetention /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/Data retention/)).toBeTruthy();
  });

  it('only shows retention.* keys (filters out unrelated)', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminDataRetention /></MemoryRouter>
      </QueryClientProvider>,
    );
    const table = await screen.findByRole('table');
    expect(within(table).getByText('retention.media.days')).toBeTruthy();
    expect(within(table).getByText('retention.audit.days')).toBeTruthy();
    expect(within(table).getByText('retention.backup.days')).toBeTruthy();
    expect(within(table).queryByText('unrelated.key')).toBeNull();
  });

  it('renders a number input per row with the current days', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminDataRetention /></MemoryRouter>
      </QueryClientProvider>,
    );
    const inputs = await screen.findAllByRole('spinbutton');
    expect(inputs.length).toBe(3);
  });

  it('shows the backup policy footer', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminDataRetention /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Backup policy')).toBeTruthy();
  });
});
