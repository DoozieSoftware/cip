import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const mutateMock = vi.fn();

vi.mock('../../api/client', () => ({
  useAdminReportTypes: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateReportType: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
  useUpdateReportType: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
  useDeleteReportType: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
}));

const { useAdminReportTypes } = await import('../../api/client');
const AdminReportTypes = (await import('../AdminReportTypes')).default;

describe('AdminReportTypes (T-M12-003 create/edit)', () => {
  beforeEach(() => {
    (useAdminReportTypes as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: [], isLoading: false });
    mutateMock.mockClear();
  });

  it('shows the empty list and a new-type button', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><AdminReportTypes /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Report types')).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ New type' })).toBeTruthy();
    expect(screen.getByText('No report types')).toBeTruthy();
  });

  it('opens the form and submits a create payload with the required fields', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><AdminReportTypes /></MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: '+ New type' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Name/), { target: { value: 'Pothole' } });
    fireEvent.change(within(dialog).getByLabelText(/Code/), { target: { value: 'pothole' } });
    fireEvent.click(within(dialog).getByLabelText('Requires photo'));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save type' }));

    expect(mutateMock).toHaveBeenCalledTimes(1);
    const arg = mutateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.name).toBe('Pothole');
    expect(arg.code).toBe('pothole');
    expect(arg.requires_photo).toBe(true);
    expect(arg.active).toBe(true);
  });
});
