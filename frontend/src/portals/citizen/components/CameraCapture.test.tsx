import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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
});
