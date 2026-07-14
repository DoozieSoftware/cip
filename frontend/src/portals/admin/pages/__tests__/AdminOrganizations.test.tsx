import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/client', () => ({
  useAdminOrganizations: vi.fn(() => ({
    data: [{ id: 'org-1', code: 'bbmp', name: 'Bruhat Bengaluru Mahanagara Palike', domain: 'bbmp.gov.in', storage_quota_mb: 10240, active: true }],
    isLoading: false,
  })),
  useCreateOrganization: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateOrganization: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteOrganization: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

const AdminOrganizations = (await import('../AdminOrganizations')).default;

describe('AdminOrganizations', () => {
  let client: QueryClient;
  beforeEach(() => { client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); });

  it('renders organization identity and quota', async () => {
    render(<QueryClientProvider client={client}><AdminOrganizations /></QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: 'Organizations' })).toBeTruthy();
    expect(screen.getByText('Bruhat Bengaluru Mahanagara Palike')).toBeTruthy();
    expect(screen.getByText(/10,240 MB/)).toBeTruthy();
  });
});
