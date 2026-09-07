/* eslint-disable */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { TextileMinimumNotice } from '../TextileMinimumNotice';

describe('TextileMinimumNotice — citizen journey (TextileCapacityMinimum.test)', () => {
  function qcWrapper({ children }: { children: React.ReactNode }) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }

  it('shows loading, then blocks a below-minimum pickup after load', async () => {
    const minimum = {
      service_zone_id: 'z1',
      min_bags: 5,
      min_weight_kg: null,
      guidance_text: 'Keep dry',
    };
    const { rerender } = render(
      <TextileMinimumNotice minimum={null} isLoading estimatedBags={2} />,
      { wrapper: qcWrapper },
    );
    expect(screen.getByText(/Checking what’s needed in your area/)).toBeInTheDocument();

    rerender(<TextileMinimumNotice minimum={minimum} estimatedBags={2} />);
    expect(screen.getAllByText(/5 bags/)).not.toHaveLength(0);
    expect(screen.getByText(/Below the pickup minimum/)).toBeInTheDocument();
  });

  it('removes the minimum block after the estimate meets the minimum', () => {
    const minimum = {
      service_zone_id: 'z1',
      min_bags: 3,
      min_weight_kg: null,
      guidance_text: null,
    };
    const { rerender } = render(<TextileMinimumNotice minimum={minimum} estimatedBags={1} />, {
      wrapper: qcWrapper,
    });
    expect(screen.getByText(/Below the pickup minimum/)).toBeInTheDocument();
    rerender(<TextileMinimumNotice minimum={minimum} estimatedBags={5} />);
    expect(screen.queryByText(/Below the pickup minimum/)).not.toBeInTheDocument();
  });

  it('shows error then after retry shows minimum', async () => {
    const minimum = {
      service_zone_id: 'z1',
      min_bags: 2,
      min_weight_kg: null,
      guidance_text: null,
    };
    const onRetry = vi.fn();
    const { rerender } = render(<TextileMinimumNotice isError minimum={null} onRetry={onRetry} />, {
      wrapper: qcWrapper,
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Try again/i }));
    expect(onRetry).toHaveBeenCalled();
    rerender(<TextileMinimumNotice minimum={minimum} estimatedBags={2} />);
    expect(screen.getByText(/2 bags/)).toBeInTheDocument();
  });

  it('empty state explains no minimum is configured', () => {
    render(
      <TextileMinimumNotice
        minimum={{
          service_zone_id: 'z1',
          min_bags: null,
          min_weight_kg: null,
          guidance_text: null,
        }}
      />,
      { wrapper: qcWrapper },
    );
    expect(screen.getByText(/No pickup minimum is set for your area/)).toBeInTheDocument();
  });
});
