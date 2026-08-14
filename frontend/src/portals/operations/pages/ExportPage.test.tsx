import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { departmentApi } from '../api/operations';
import ExportPage from './ExportPage';

const DEPARTMENT_ID = '11111111-1111-1111-1111-111111111111';

vi.mock('../context/DepartmentSelectionContext', () => ({
  useDepartmentSelection: () => ({ selectedId: DEPARTMENT_ID }),
}));

vi.mock('../api/operations', () => ({
  departmentApi: {
    exportDownload: vi.fn(),
    exportUrl: vi.fn(() => '/api/v1/department/reports/export'),
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(departmentApi.exportDownload).mockResolvedValue();
});

describe('ExportPage', () => {
  it('uses a status selector and does not display the scoped department ID', async () => {
    render(<ExportPage />);

    const statusSelect = screen.getByRole('combobox', { name: 'Status' });
    expect(screen.getByRole('option', { name: 'Work in progress' })).toBeInTheDocument();
    expect(screen.queryByText(DEPARTMENT_ID, { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText(/Status code/i)).not.toBeInTheDocument();

    fireEvent.change(statusSelect, { target: { value: 'in_progress' } });
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() =>
      expect(departmentApi.exportDownload).toHaveBeenCalledWith('csv', {
        status: 'in_progress',
        search: '',
        department_id: DEPARTMENT_ID,
      }),
    );
  });
});
