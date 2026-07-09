import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const mutateMock = vi.fn();

vi.mock('../../api/client', () => ({
  useAdminUsers: vi.fn(() => ({ data: [], isLoading: false })),
  useAdminRoles: vi.fn(() => ({ data: [{ id: 'r1', name: 'moderator', guard_name: 'web', permissions: [], protected: false }], isLoading: false })),
  useCreateUser: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
  useUpdateUser: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
  useDeleteUser: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
}));

const { useAdminUsers, useAdminRoles } = await import('../../api/client');
const AdminUsers = (await import('../AdminUsers')).default;

const renderPage = (): void => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter><AdminUsers /></MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('AdminUsers (T-M12-001 create/edit)', () => {
  beforeEach(() => {
    (useAdminUsers as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: [], isLoading: false });
    (useAdminRoles as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: [{ id: 'r1', name: 'moderator', guard_name: 'web', permissions: [], protected: false }], isLoading: false });
    mutateMock.mockClear();
  });

  it('shows the empty list and a new-user button', async () => {
    renderPage();
    expect(await screen.findByText('Users')).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ New user' })).toBeTruthy();
    expect(screen.getByText('No users')).toBeTruthy();
  });

  it('opens the form and submits a create payload with the selected role', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '+ New user' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Mobile/), { target: { value: '+919999999999' } });
    fireEvent.change(within(dialog).getByLabelText(/Password/), { target: { value: 'secret123' } });
    // select the moderator role checkbox
    fireEvent.click(within(dialog).getByLabelText('moderator'));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save user' }));

    expect(mutateMock).toHaveBeenCalledTimes(1);
    const arg = mutateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.mobile).toBe('+919999999999');
    expect(arg.password).toBe('secret123');
    expect(arg.roles).toEqual(['moderator']);
    expect(arg.status).toBe('active');
  });
});
