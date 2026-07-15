import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GpsCapture } from './GpsCapture';

describe('GpsCapture', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('explains how to enable location and lets the citizen retry after permission denial', async () => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) => {
      error({ code: 1, message: 'User denied Geolocation', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
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
});
