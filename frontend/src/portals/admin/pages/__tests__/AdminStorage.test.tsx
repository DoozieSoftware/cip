import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const mutateMock = vi.fn();

vi.mock('../../api/client', () => ({
  useMediaStorage: vi.fn(),
  useUpdateMediaStorage: vi.fn(() => ({ mutate: mutateMock, isPending: false, isError: false, isSuccess: false })),
  useProbeMediaStorage: vi.fn(() => ({ mutate: mutateMock, isPending: false, data: undefined })),
}));

 
const { useMediaStorage } = await import('../../api/client');
const AdminStorage = (await import('../AdminStorage')).default;

const STORAGE = {
  id: 'media_storage',
  key: 'media_storage',
  value: { disk: 'media_local', bucket: '', endpoint: '', region: '', retention_days: 90, max_upload_mb: 20, public_url: '' },
  updated_at: '2026-06-29T10:00:00Z',
};

describe('AdminStorage (T-M12-022)', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    mutateMock.mockClear();
    (useMediaStorage as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: STORAGE, isLoading: false });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminStorage /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Media storage')).toBeTruthy();
  });

  it('renders the disk select with media_local preselected', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminStorage /></MemoryRouter>
      </QueryClientProvider>,
    );
    const diskSelect = (await screen.findAllByRole('combobox'))[0] as HTMLSelectElement;
    expect(diskSelect.value).toBe('media_local');
  });

  it('renders the probe and save buttons', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminStorage /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Probe reachability')).toBeTruthy();
    expect(screen.getByText('Save storage config')).toBeTruthy();
  });
});
