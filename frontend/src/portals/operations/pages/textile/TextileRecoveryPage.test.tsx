import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TextileRecoveryPage from './TextileRecoveryPage';
import type * as TextileShared from './shared';

const mockOpsQueue = {
  pending: [] as Array<Record<string, unknown>>,
  dead: [] as Array<Record<string, unknown>>,
  drain: vi.fn(),
  remove: vi.fn(),
  clearDone: vi.fn(),
};

vi.mock('../../offline/useOpsQueue', () => ({
  useOpsQueue: () => mockOpsQueue,
}));

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

function renderPage(): void {
  render(
    <MemoryRouter>
      <TextileRecoveryPage />
    </MemoryRouter>,
  );
}

describe('TextileRecoveryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOpsQueue.pending = [];
    mockOpsQueue.dead = [];
  });

  it('renders empty state when there are no failed uploads', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Upload recovery' })).toBeInTheDocument();
    expect(screen.getByText('No pending or failed uploads')).toBeInTheDocument();
  });

  it('renders Clear completed button when pending items exist without failures', () => {
    mockOpsQueue.pending = [{ id: 'p-1', status: 'uploaded' }];
    renderPage();

    const clearBtn = screen.getByRole('button', { name: 'Clear completed' });
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);
    expect(mockOpsQueue.clearDone).toHaveBeenCalled();
  });

  it('renders failed uploads with details and action buttons', () => {
    mockOpsQueue.pending = [
      {
        id: 'fail-1',
        kind: 'collection_proof',
        status: 'failed',
        attempts: 3,
        max_attempts: 5,
        last_error: 'Network timeout',
        payload: {
          reference: 'DLN-REC-99',
          actualBags: 2,
          actualWeightKg: 6,
          photoName: 'proof.jpg',
        },
      },
    ];

    renderPage();

    expect(screen.getByText(/DLN-REC-99/)).toBeInTheDocument();
    expect(screen.getByText(/2 bags · 6 kg · proof.jpg/)).toBeInTheDocument();
    expect(screen.getByText(/attempts 3\/5/)).toBeInTheDocument();
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry all' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard fail-1' })).toBeInTheDocument();
  });

  it('triggers drain when Retry all is clicked', () => {
    mockOpsQueue.dead = [
      {
        id: 'dead-1',
        kind: 'collection_proof',
        status: 'dead',
        attempts: 5,
        max_attempts: 5,
        payload: { reference: 'DLN-DEAD-1' },
      },
    ];

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Retry all' }));
    expect(mockOpsQueue.drain).toHaveBeenCalled();
  });

  it('triggers remove when Discard is clicked', () => {
    mockOpsQueue.dead = [
      {
        id: 'dead-1',
        kind: 'collection_proof',
        status: 'dead',
        attempts: 5,
        max_attempts: 5,
        payload: { reference: 'DLN-DEAD-1' },
      },
    ];

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Discard dead-1' }));
    expect(mockOpsQueue.remove).toHaveBeenCalledWith('dead-1');
  });
});
