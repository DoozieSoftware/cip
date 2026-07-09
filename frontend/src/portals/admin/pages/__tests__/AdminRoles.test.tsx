import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const createMock = vi.fn();
const updateMock = vi.fn();
const syncMock = vi.fn();

vi.mock('../../api/client', () => ({
  useAdminRoles: vi.fn(() => ({ data: [], isLoading: false })),
  useAdminPermissions: vi.fn(() => ({ data: [{ id: 1, name: 'audit.view' }, { id: 2, name: 'report.view' }], isLoading: false })),
  useCreateRole: vi.fn(() => ({ mutate: createMock, isPending: false })),
  useUpdateRole: vi.fn(() => ({ mutate: updateMock, isPending: false })),
  useSyncRolePermissions: vi.fn(() => ({ mutate: syncMock, isPending: false })),
}));

const { useAdminRoles, useAdminPermissions } = await import('../../api/client');
const AdminRoles = (await import('../AdminRoles')).default;

describe('AdminRoles (T-M12-002 create/edit)', () => {
  beforeEach(() => {
    (useAdminRoles as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: [], isLoading: false });
    (useAdminPermissions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: [{ id: 1, name: 'audit.view' }, { id: 2, name: 'report.view' }], isLoading: false });
    createMock.mockReset();
    updateMock.mockReset();
    syncMock.mockReset();
  });

  it('renders the title and the partial-enforcement note', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><AdminRoles /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Roles & permissions')).toBeTruthy();
    expect(screen.getByText(/Partially enforced/)).toBeTruthy();
  });

  it('creates a role with selected permissions', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><AdminRoles /></MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: '+ New role' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Name/), { target: { value: 'supervisor' } });
    fireEvent.click(within(dialog).getByLabelText('audit.view'));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save role' }));

    expect(createMock).toHaveBeenCalledTimes(1);
    const arg = createMock.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.name).toBe('supervisor');
    expect(arg.permissions).toEqual(['audit.view']);
  });
});
