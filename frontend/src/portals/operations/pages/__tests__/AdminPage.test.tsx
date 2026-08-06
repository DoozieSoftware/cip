import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/operations', () => ({
  adminApi: {
    listDepartments: vi.fn(),
    listOfficers: vi.fn(),
    attachOfficer: vi.fn(),
    detachOfficer: vi.fn(),
    updateAdmin: vi.fn(),
  },
}));

vi.mock('../context/DepartmentSelectionContext', () => ({
  useDepartmentSelection: vi.fn(() => ({
    selectedId: 'dept-1',
    ready: true,
    memberships: [{ id: 'dept-1', name: 'BBMP', code: 'bbmp' }],
    select: vi.fn(),
  })),
}));

vi.mock('../../../../auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'u-1', name: 'Admin', roles: ['super_admin'] },
    token: 'mock-token',
    isAuthenticated: true,
    hasAnyRole: vi.fn(() => true),
    logout: vi.fn(),
    login: vi.fn(),
    loading: false,
  })),
}));

const { adminApi } = await import('../api/operations');
const AdminPage = (await import('../AdminPage')).default;

describe('OperationsAdminPage', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    (adminApi.listDepartments as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [{ id: 'dept-1', code: 'bbmp', name: 'BBMP' }],
    });
    (adminApi.listOfficers as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [
        {
          id: 'off-1',
          name: 'Officer One',
          mobile: '+919999999999',
          email: 'officer@bbmp.gov',
          is_manager: false,
          assigned_at: '2026-01-01T00:00:00Z',
        },
      ],
      meta: { total: 1 },
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Department admin')).toBeTruthy();
  });

  it('renders officers table', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Officer One')).toBeTruthy();
    expect(screen.getByText('officer@bbmp.gov')).toBeTruthy();
  });

  it('shows loading state for departments', () => {
    (adminApi.listDepartments as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading departments')).toBeTruthy();
  });

  it('shows loading state for officers', () => {
    (adminApi.listOfficers as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading admin')).toBeTruthy();
  });

  it('shows no department assigned message when no department', async () => {
    vi.resetModules();
    vi.mock('../context/DepartmentSelectionContext', () => ({
      useDepartmentSelection: vi.fn(() => ({
        selectedId: null,
        ready: true,
        memberships: [],
        select: vi.fn(),
      })),
    }));
    const { default: AdminPageNoDept } = await import('../AdminPage');
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminPageNoDept />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('No department is assigned to this account.')).toBeTruthy();
  });
});
