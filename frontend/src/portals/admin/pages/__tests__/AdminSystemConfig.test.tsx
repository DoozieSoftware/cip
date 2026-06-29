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
const AdminSystemConfig = (await import('../AdminSystemConfig')).default;

const ROWS = [
  { id: 's1', key: 'limits.upload.per_hour', value: 20, type: 'int' as const, description: 'Max uploads per citizen per hour', is_public: false, created_at: null, updated_at: null },
  { id: 's2', key: 'locale.default', value: 'en-IN', type: 'string' as const, description: 'Default UI locale', is_public: true, created_at: null, updated_at: null },
  { id: 's3', key: 'retention.media.days', value: 90, type: 'int' as const, description: 'Media retention', is_public: false, created_at: null, updated_at: null },
  { id: 's4', key: 'media_storage', value: {}, type: 'json' as const, description: null, is_public: false, created_at: null, updated_at: null },
  { id: 's5', key: 'app_configs', value: {}, type: 'json' as const, description: null, is_public: false, created_at: null, updated_at: null },
];

describe('AdminSystemConfig (T-M12-028)', () => {
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
        <MemoryRouter><AdminSystemConfig /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('System configuration')).toBeTruthy();
  });

  it('only shows system keys (excludes retention/media_storage/app_configs)', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminSystemConfig /></MemoryRouter>
      </QueryClientProvider>,
    );
    const table = await screen.findByRole('table');
    expect(within(table).getByText('limits.upload.per_hour')).toBeTruthy();
    expect(within(table).getByText('locale.default')).toBeTruthy();
    expect(within(table).queryByText('retention.media.days')).toBeNull();
    expect(within(table).queryByText('media_storage')).toBeNull();
    expect(within(table).queryByText('app_configs')).toBeNull();
  });

  it('renders the new setting button and the save / delete actions per row', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminSystemConfig /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('button', { name: 'New setting' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Save' }).length).toBe(2);
    expect(screen.getAllByRole('button', { name: 'Delete' }).length).toBe(2);
  });
});
