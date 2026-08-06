import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/operations', () => ({
  departmentApi: {
    exportUrl: vi.fn(),
    exportDownload: vi.fn(),
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

const opsMod = (await import('../api/operations')) as {
  departmentApi: Record<string, ReturnType<typeof vi.fn>>;
};
const { departmentApi } = opsMod;
const ExportPage = (await import('../ExportPage')).default;

describe('ExportPage', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    departmentApi.exportUrl.mockReturnValue('/api/v1/department/reports/export?format=csv');
    departmentApi.exportDownload.mockResolvedValue(undefined);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ExportPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Export reports')).toBeTruthy();
  });

  it('renders format buttons', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ExportPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('CSV')).toBeTruthy();
    expect(screen.getByText('XLSX')).toBeTruthy();
    expect(screen.getByText('PDF')).toBeTruthy();
  });

  it('renders filter inputs', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ExportPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByLabelText('Status code')).toBeTruthy();
    expect(screen.getByLabelText('Search')).toBeTruthy();
  });

  it('renders download button', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ExportPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Download')).toBeTruthy();
  });

  it('switches format on click', () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ExportPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText('XLSX'));
    expect(screen.getByText('XLSX')).toBeTruthy();
  });
});
