import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/client', () => ({
  useAdminDepartments: vi.fn(() => ({
    data: [{ id: 'dept-1', name: 'BBMP Ward 112', code: 'BBMP-112', jurisdiction: 'Bengaluru', default_sla_minutes: 1440, active: true }],
    isLoading: false,
  })),
  useCreateDepartment: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateDepartment: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteDepartment: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

const AdminDepartments = (await import('../AdminDepartments')).default;

describe('AdminDepartments', () => {
  let client: QueryClient;
  beforeEach(() => { client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); });

  it('renders human-readable department data', async () => {
    render(<QueryClientProvider client={client}><AdminDepartments /></QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: 'Departments' })).toBeTruthy();
    expect(screen.getByText('BBMP Ward 112')).toBeTruthy();
    expect(screen.getByText('Bengaluru')).toBeTruthy();
  });
});
