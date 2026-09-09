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
      min_bags: null,
      min_weight_kg: 4,
      guidance_text: 'Keep dry',
    };
    const { rerender } = render(
      <TextileMinimumNotice minimum={null} isLoading estimatedWeightKg={2} />,
      { wrapper: qcWrapper },
    );
    expect(screen.getByText(/Checking what’s needed in your area/)).toBeInTheDocument();

    rerender(<TextileMinimumNotice minimum={minimum} estimatedWeightKg={2} />);
    expect(screen.getAllByText(/4 kg/)).not.toHaveLength(0);
    expect(screen.getByText(/Below the pickup minimum/)).toBeInTheDocument();
    expect(screen.getByText(/Home pickup needs at least 4 kg/)).toBeInTheDocument();
  });

  it('removes the minimum block after the weight meets the minimum', () => {
    const minimum = {
      service_zone_id: 'z1',
      min_bags: null,
      min_weight_kg: 4,
      guidance_text: null,
    };
    const { rerender } = render(<TextileMinimumNotice minimum={minimum} estimatedWeightKg={1} />, {
      wrapper: qcWrapper,
    });
    expect(screen.getByText(/Below the pickup minimum/)).toBeInTheDocument();
    rerender(<TextileMinimumNotice minimum={minimum} estimatedWeightKg={5} />);
    expect(screen.queryByText(/Below the pickup minimum/)).not.toBeInTheDocument();
  });

  it('lets any bag count pass without a weight estimate', () => {
    const minimum = {
      service_zone_id: 'z1',
      min_bags: 50,
      min_weight_kg: 4,
      guidance_text: null,
    };
    render(<TextileMinimumNotice minimum={minimum} estimatedBags={1} />, {
      wrapper: qcWrapper,
    });
    expect(screen.queryByText(/Below the pickup minimum/)).not.toBeInTheDocument();
  });

  it('shows error then after retry shows minimum', async () => {
    const minimum = {
      service_zone_id: 'z1',
      min_bags: null,
      min_weight_kg: 4,
      guidance_text: null,
    };
    const onRetry = vi.fn();
    const { rerender } = render(<TextileMinimumNotice isError minimum={null} onRetry={onRetry} />, {
      wrapper: qcWrapper,
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Try again/i }));
    expect(onRetry).toHaveBeenCalled();
    rerender(<TextileMinimumNotice minimum={minimum} estimatedWeightKg={4} />);
    expect(screen.getByText(/4 kg/)).toBeInTheDocument();
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
