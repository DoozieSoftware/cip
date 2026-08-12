import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BulkActionsBar } from './BulkActionsBar';

const reports = [
  { id: 'internal-report-1', tracking_number: 'CIP-2026-001', title: 'Broken streetlight' },
  { id: 'internal-report-2', tracking_number: 'CIP-2026-002', title: 'Dark junction' },
];

describe('BulkActionsBar', () => {
  it('selects a canonical report by its user-facing tracking number', () => {
    const onApply = vi.fn();
    render(<BulkActionsBar reports={reports} onApply={onApply} loading={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Bulk merge' }));

    expect(screen.queryByText(/UUID/i)).not.toBeInTheDocument();
    const apply = screen.getByRole('button', { name: 'Apply to 2 reports' });
    expect(apply).toBeDisabled();
    expect(apply).toHaveClass('disabled:text-white');

    fireEvent.change(screen.getByLabelText('Canonical report'), {
      target: { value: 'internal-report-2' },
    });
    fireEvent.click(apply);

    expect(onApply).toHaveBeenCalledWith({
      type: 'merge',
      reason_code: undefined,
      remarks: undefined,
      canonical_id: 'internal-report-2',
    });
  });

  it('presents rejection reasons as labels while submitting the internal code', () => {
    const onApply = vi.fn();
    render(<BulkActionsBar reports={reports} onApply={onApply} loading={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Bulk reject' }));

    expect(screen.queryByLabelText('Reason code')).not.toBeInTheDocument();
    const apply = screen.getByRole('button', { name: 'Apply to 2 reports' });
    expect(apply).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'invalid_evidence' } });
    fireEvent.click(apply);

    expect(onApply).toHaveBeenCalledWith({
      type: 'reject',
      reason_code: 'invalid_evidence',
      remarks: undefined,
      canonical_id: undefined,
    });
  });
});
