import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GpsCapture } from './GpsCapture';

describe('GpsCapture', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('explains how to enable location and lets the citizen retry after permission denial', async () => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) => {
      error({
        code: 1,
        message: 'User denied Geolocation',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
    });
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      geolocation: { getCurrentPosition },
    });

    render(<GpsCapture onCapture={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Use my location/ }));

    expect(await screen.findByText('How to enable location')).toBeVisible();
    expect(screen.getByText(/In the browser site settings, allow Location/i)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(2));
  });

  it('captures a coarse fix instead of rejecting it, and reports the accuracy warning', async () => {
    const onCapture = vi.fn();
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 12.9716, longitude: 77.5946, accuracy: 4547, altitude: null },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      geolocation: { getCurrentPosition },
    });

    render(<GpsCapture onCapture={onCapture} />);
    fireEvent.click(screen.getByRole('button', { name: /Use my location/ }));

    await waitFor(() => expect(onCapture).toHaveBeenCalledTimes(1));
    const captured = onCapture.mock.calls[0][0] as { latitude: number; accuracy_m: number };
    expect(captured.latitude).toBeCloseTo(12.9716);
    expect(captured.accuracy_m).toBe(4547);
    expect(await screen.findByText(/GPS accuracy is ±4547 m/)).toBeVisible();
    expect(screen.queryByText(/try moving to an open area/)).toBeVisible();
  });
});
