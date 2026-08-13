import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from '../api/operations';
import AdminPage from './AdminPage';

vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { departments: [], roles: ['super_admin'] },
    hasAnyRole: (roles: string[]) => roles.includes('super_admin'),
  }),
}));

vi.mock('../api/operations', () => ({
  adminApi: {
    listDepartments: vi.fn(),
    listOfficers: vi.fn(),
    listAttachableUsers: vi.fn(),
    attachOfficer: vi.fn(),
    detachOfficer: vi.fn(),
    updateAdmin: vi.fn(),
  },
}));

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AdminPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(adminApi.listDepartments).mockResolvedValue([
    { id: 'department-1', code: 'ROADS', name: 'Roads Department' },
  ]);
  vi.mocked(adminApi.listOfficers).mockResolvedValue({
    data: [],
    meta: { total: 0 },
  });
  vi.mocked(adminApi.listAttachableUsers).mockResolvedValue([
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Asha Rao',
      mobile: '9876543210',
      email: 'asha@example.test',
    },
  ]);
  vi.mocked(adminApi.attachOfficer).mockResolvedValue({
    pivot_id: 'pivot-1',
    department_id: 'department-1',
  });
});

describe('AdminPage', () => {
  it('selects an officer by name without exposing a UUID input', async () => {
    renderPage();

    const officerSelect = await screen.findByRole('combobox', { name: 'Officer' });
    expect(screen.queryByText(/UUID/i)).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Asha Rao (9876543210)' })).toBeInTheDocument();

    fireEvent.change(officerSelect, { target: { value: '11111111-1111-1111-1111-111111111111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Attach officer' }));

    await waitFor(() =>
      expect(adminApi.attachOfficer).toHaveBeenCalledWith('department-1', {
        user_id: '11111111-1111-1111-1111-111111111111',
        is_manager: false,
      }),
    );
  });
});
