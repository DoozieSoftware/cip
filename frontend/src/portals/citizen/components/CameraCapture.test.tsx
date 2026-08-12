import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { CameraCapture } from './CameraCapture';

describe('CameraCapture open button label', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders "Open camera" for photo mode (no redundant ternary)', () => {
    render(<CameraCapture mode="photo" onCapture={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.some((b) => b.textContent === 'Open camera')).toBe(true);
  });

  it('renders "Open camera" for video mode (no redundant ternary)', () => {
    render(<CameraCapture mode="video" onCapture={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.some((b) => b.textContent === 'Open camera')).toBe(true);
  });

  it('labels the live preview for screen-reader users', () => {
    render(<CameraCapture mode="video" onCapture={() => {}} />);
    expect(screen.getByLabelText('Live camera preview')).toBeInTheDocument();
  });

  it('offers a keyboard-accessible retry when camera permission fails', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException('blocked', 'NotAllowedError'));
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    render(<CameraCapture mode="photo" onCapture={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open camera' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/camera permission is blocked/i);
    const retry = screen.getByRole('button', { name: 'Try camera again' });
    expect(retry).toHaveAttribute('type', 'button');
    fireEvent.click(retry);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
  });
});
