import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { Dialog, Textarea } from '../index';

/**
 * Mirrors how ReportDetailPage wires the reject dialog: an inline
 * `onClose` arrow (new identity every render) and a controlled
 * Textarea bound to parent state. Every keystroke re-renders the
 * parent, which used to re-run the Dialog's focus effect and yank
 * focus out of the textarea.
 */
function RejectLikeDialog() {
  const [open, setOpen] = useState(true);
  const [remarks, setRemarks] = useState('');
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Reject report">
      <Textarea
        label="Notes"
        name="remarks"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
      />
    </Dialog>
  );
}

describe('Dialog focus management', () => {
  it('focuses the dialog container when it opens', () => {
    render(<RejectLikeDialog />);
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('keeps focus in the textarea while typing across re-renders', () => {
    render(<RejectLikeDialog />);
    const textarea = screen.getByRole('textbox');

    textarea.focus();
    expect(textarea).toHaveFocus();

    fireEvent.change(textarea, { target: { value: 'n' } });

    // After the keystroke the parent re-renders with a fresh onClose.
    // Focus must stay in the textarea, not jump back to the dialog.
    expect(textarea).toHaveFocus();
    expect(textarea).toHaveValue('n');

    fireEvent.change(textarea, { target: { value: 'no bus stop' } });
    expect(textarea).toHaveFocus();
    expect(textarea).toHaveValue('no bus stop');
  });

  it('closes on Escape using the latest onClose', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Dialog open onClose={onClose} title="t">
        <p>body</p>
      </Dialog>,
    );
    // Re-render with a new onClose identity, then press Escape.
    const onClose2 = vi.fn();
    rerender(
      <Dialog open onClose={onClose2} title="t">
        <p>body</p>
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose2).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
