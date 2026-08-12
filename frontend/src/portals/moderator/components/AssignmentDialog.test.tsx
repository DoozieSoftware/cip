import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AssignmentDialog } from './AssignmentDialog';

describe('AssignmentDialog', () => {
  it('uses a department name selector and submits its internal id', () => {
    const onSubmit = vi.fn();

    render(
      <AssignmentDialog
        open
        onClose={vi.fn()}
        onSubmit={onSubmit}
        loading={false}
        departmentsLoading={false}
        departments={[{ value: 'department-1', label: 'Traffic Engineering Cell' }]}
      />,
    );

    expect(screen.queryByText(/UUID/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Reassign' })).toBeVisible();

    fireEvent.change(screen.getByRole('combobox', { name: 'Department' }), {
      target: { value: 'department-1' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
      target: { value: 'Route to the responsible team' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reassign' }));

    expect(onSubmit).toHaveBeenCalledWith({
      department_id: 'department-1',
      reason: 'Route to the responsible team',
    });
  });
});
