import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageStates } from '../PageStates';

function makeQuery(overrides: Partial<{ isLoading: boolean; isError: boolean; data: unknown; error: unknown; refetch: ReturnType<typeof vi.fn> }> = {}) {
  return {
    isLoading: false,
    isError: false,
    data: undefined,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

describe('PageStates (T-M13-020)', () => {
  it('renders the spinner while loading', () => {
    render(
      <PageStates query={makeQuery({ isLoading: true })} loadingLabel="Loading reports">
        {() => <p>data</p>}
      </PageStates>,
    );
    expect(screen.getByRole('status', { name: /loading reports/i })).toBeInTheDocument();
  });

  it('renders the error state with retry button when isError', () => {
    const refetch = vi.fn();
    render(
      <PageStates
        query={makeQuery({ isError: true, error: new Error('boom'), refetch })}
        onRetry={refetch}
      >
        {() => <p>data</p>}
      </PageStates>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/boom/);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('renders the empty state when data is null', () => {
    render(
      <PageStates
        query={makeQuery({ data: undefined })}
        emptyTitle="No notifications"
        emptyDescription="Submit a report to see updates here."
      >
        {() => <p>data</p>}
      </PageStates>,
    );
    expect(screen.getByText(/no notifications/i)).toBeInTheDocument();
    expect(screen.getByText(/submit a report/i)).toBeInTheDocument();
  });

  it('renders the data view when data is present', () => {
    render(
      <PageStates query={makeQuery({ data: { hello: 'world' } })}>
        {(d) => <p data-testid="data">{JSON.stringify(d)}</p>}
      </PageStates>,
    );
    expect(screen.getByTestId('data')).toHaveTextContent('"hello":"world"');
  });
});
