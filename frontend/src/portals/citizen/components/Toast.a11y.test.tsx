import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';

function TestConsumer() {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() => toast.show('Something went wrong', 'error')}
    >
      trigger error
    </button>
  );
}

function TestInfoConsumer() {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.show('All good', 'success')}>
      trigger success
    </button>
  );
}

describe('Toast accessibility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('announces errors via an assertive live region with alert role', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText('trigger error').click();
    });

    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0]).toHaveTextContent('Something went wrong');
    expect(alerts[0].closest('[aria-live]')?.getAttribute('aria-live')).toBe(
      'assertive',
    );
  });

  it('announces success info via a polite live region with status role', () => {
    render(
      <ToastProvider>
        <TestInfoConsumer />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText('trigger success').click();
    });

    const statusElements = screen.getAllByRole('status');
    const successEl = statusElements.find((el) => el.textContent === 'All good');
    expect(successEl).toBeDefined();
    expect(
      successEl?.closest('[aria-live]')?.getAttribute('aria-live'),
    ).toBe('polite');
  });
});
