import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TextileOfflineRecoveryPage from './TextileOfflineRecoveryPage';
import * as textileApi from '../../api/textileApi';
import type * as TextileShared from './shared';

vi.mock('./shared', async () => {
  const actual = await vi.importActual<typeof TextileShared>('./shared');
  return {
    ...actual,
    useDesk: () => ({
      ready: true,
      isDrLinen: true,
      departmentId: 'dep-textile',
      departmentCode: 'DR_LINEN',
      departmentName: 'Dr Linen',
    }),
  };
});

vi.mock('../../api/textileApi', () => ({
  fetchOfflineRecovery: vi.fn(),
  resolveOfflineRecovery: vi.fn(),
}));

const mockItems = [
  {
    id: 'off-1',
    status: 'pending',
    collection_request_id: 'col-1',
    collection: {
      reference: 'DLN-2026-REC-01',
      pickup_address: '12 Indiranagar 100ft Rd',
    },
    payload_snapshot: {
      actual_bags: 3,
      actual_weight_kg: 9.5,
    },
    failure_reason: 'Camera upload failed with 500 server error',
    idempotency_key: 'idemp-abc-123',
    created_at: '2026-09-01T10:00:00Z',
  },
];

function renderPage(): void {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TextileOfflineRecoveryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TextileOfflineRecoveryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header and filter tabs', () => {
    vi.mocked(textileApi.fetchOfflineRecovery).mockResolvedValue([]);
    renderPage();

    expect(screen.getByRole('heading', { name: 'Offline recovery' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pending/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resolved' })).toBeInTheDocument();
  });

  it('displays empty state when no recovery items exist', async () => {
    vi.mocked(textileApi.fetchOfflineRecovery).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('No pending offline failures')).toBeInTheDocument();
  });

  it('renders recovery items with reference, payload snapshot, and resolve button', async () => {
    vi.mocked(textileApi.fetchOfflineRecovery).mockResolvedValue(mockItems);
    renderPage();

    expect(await screen.findByText('DLN-2026-REC-01')).toBeInTheDocument();
    expect(screen.getByText('12 Indiranagar 100ft Rd')).toBeInTheDocument();
    expect(screen.getByText('Camera upload failed with 500 server error')).toBeInTheDocument();
    expect(screen.getByText(/Payload snapshot/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark resolved' })).toBeInTheDocument();
  });

  it('resolves an offline failure when Mark resolved is clicked', async () => {
    vi.mocked(textileApi.fetchOfflineRecovery).mockResolvedValue(mockItems);
    vi.mocked(textileApi.resolveOfflineRecovery).mockResolvedValue({
      id: 'off-1',
      status: 'resolved',
    });

    renderPage();
    const resolveBtn = await screen.findByRole('button', { name: 'Mark resolved' });
    fireEvent.click(resolveBtn);

    await waitFor(() => {
      expect(textileApi.resolveOfflineRecovery).toHaveBeenCalledWith('off-1', 'dep-textile');
    });
  });

  it('switches to resolved filter on click', async () => {
    vi.mocked(textileApi.fetchOfflineRecovery).mockResolvedValue([]);
    renderPage();

    const resolvedTab = screen.getByRole('button', { name: 'Resolved' });
    fireEvent.click(resolvedTab);

    expect(await screen.findByText('No resolved offline failures')).toBeInTheDocument();
    expect(textileApi.fetchOfflineRecovery).toHaveBeenCalledWith({
      department_id: 'dep-textile',
      status: 'resolved',
    });
  });
});
