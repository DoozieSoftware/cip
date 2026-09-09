import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QrScanner } from './QrScanner';

describe('QrScanner', () => {
  it('forwards a pasted code for verification', () => {
    const onScan = vi.fn();
    render(<QrScanner onScan={onScan} />);

    // jsdom has no BarcodeDetector — the manual path is the scanner here.
    expect(screen.queryByRole('button', { name: 'Scan with camera' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Paste a receipt code'), {
      target: { value: 'pasted-code' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(onScan).toHaveBeenCalledWith('pasted-code');
  });

  it('keeps Verify disabled until something is pasted', () => {
    render(<QrScanner onScan={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
  });

  it('supports booking-specific scanner labels', () => {
    render(
      <QrScanner
        onScan={vi.fn()}
        cameraLabel="Scan booking QR with camera"
        pasteLabel="Paste booking QR reference"
        pastePlaceholder="DLN-…"
      />,
    );

    expect(screen.getByLabelText('Paste booking QR reference')).toHaveAttribute(
      'placeholder',
      'DLN-…',
    );
  });

  it('hides the paste fallback when an existing lookup field owns manual entry', () => {
    render(<QrScanner onScan={vi.fn()} showPaste={false} />);

    expect(screen.queryByLabelText('Paste a receipt code')).not.toBeInTheDocument();
    expect(screen.queryByText(/Camera scanning is not available/)).not.toBeInTheDocument();
  });
});
