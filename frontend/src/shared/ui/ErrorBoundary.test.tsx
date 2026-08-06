import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ErrorBoundary, ErrorState } from '../index';

function Boom(): ReactNode {
  throw new Error('boom');
}

describe('ErrorBoundary / ErrorState (T-M13-020)', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('renders the default fallback when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });

  it('invokes a custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={(err) => <span data-testid="custom">caught: {err.message}</span>}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('custom')).toHaveTextContent('caught: boom');
  });

  it('does not render the fallback when children render normally', () => {
    render(
      <ErrorBoundary>
        <p data-testid="ok">all good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('ok')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ErrorState renders the supplied error message', () => {
    render(<ErrorState error={new Error('connection refused')} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/connection refused/);
  });
});
