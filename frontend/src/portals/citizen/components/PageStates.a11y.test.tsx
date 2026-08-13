import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageStates } from './PageStates';

function makeQuery(
  overrides: Partial<{
    isLoading: boolean;
    isError: boolean;
    data: unknown;
    error: unknown;
    refetch: ReturnType<typeof vi.fn>;
  }> = {},
) {
  return {
    isLoading: false,
    isError: false,
    data: undefined,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

describe('PageStates accessibility', () => {
  it('wraps the error state in an assertive live region for screen readers', () => {
    const { container } = render(
      <PageStates
        query={makeQuery({ isError: true, error: new Error('Network down') })}
      >
        {() => <p>data</p>}
      </PageStates>,
    );

    const alertRegion = screen.getByRole('alert');
    expect(alertRegion).toHaveTextContent(/load this page/i);

    const assertiveRegion = container.querySelector('[aria-live="assertive"]');
    expect(assertiveRegion).not.toBeNull();
    expect(assertiveRegion?.contains(alertRegion)).toBe(true);
  });
});
