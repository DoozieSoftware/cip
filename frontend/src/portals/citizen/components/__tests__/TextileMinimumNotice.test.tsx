import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TextileMinimumNotice, isBelowMinimum } from '../TextileMinimumNotice';
import type { TextileCapacityMinimum } from '../../api/textileZones';

describe('TextileMinimumNotice', () => {
  it('shows loading state', () => {
    render(<TextileMinimumNotice isLoading minimum={null} />);
    expect(screen.getByText(/Checking what’s needed in your area/)).toBeInTheDocument();
  });

  it('shows error state with alert and retry', () => {
    const onRetry = vi.fn();
    render(<TextileMinimumNotice isError minimum={null} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Could not check the minimum/);
    const btn = screen.getByRole('button', { name: /Try again/i });
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows error state without retry when onRetry not provided', () => {
    render(<TextileMinimumNotice isError minimum={null} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Try again/i })).not.toBeInTheDocument();
  });

  it('shows empty state when no minimum is configured', () => {
    render(
      <TextileMinimumNotice
        minimum={{
          service_zone_id: 'z1',
          min_bags: null,
          min_weight_kg: null,
          guidance_text: null,
        }}
      />,
    );
    expect(screen.getByText(/No minimum in your area/)).toBeInTheDocument();
  });

  it('renders minimum with bags and guidance text', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: 5,
      min_weight_kg: 10,
      guidance_text: 'Keep bags dry.',
    };
    render(<TextileMinimumNotice minimum={minimum} estimatedBags={6} estimatedWeightKg={12} />);
    expect(screen.getByText(/5 bags or 10 kg/)).toBeInTheDocument();
    expect(screen.getByText(/Keep bags dry/)).toBeInTheDocument();
    expect(screen.getByText(/Your estimate meets the guidance/)).toBeInTheDocument();
  });

  it('renders minimum without guidance fallback', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: 3,
      min_weight_kg: null,
      guidance_text: null,
    };
    render(<TextileMinimumNotice minimum={minimum} estimatedBags={5} />);
    expect(screen.getByText(/3 bags/)).toBeInTheDocument();
    expect(screen.getByText(/Fill bags or kg/)).toBeInTheDocument();
  });

  it('blocks home pickup guidance when below minimum by bags', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: 5,
      min_weight_kg: null,
      guidance_text: null,
    };
    render(
      <TextileMinimumNotice
        minimum={minimum}
        estimatedBags={2}
        isLoading={false}
        isError={false}
      />,
    );
    expect(screen.getByText(/Below the pickup minimum/)).toBeInTheDocument();
    expect(screen.getByText(/Small loads waste a trip/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /note|exception/i })).not.toBeInTheDocument();
  });

  it('shows the drop-off alternative when below minimum by weight', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: null,
      min_weight_kg: 10,
      guidance_text: 'Keep bags dry.',
    };
    render(<TextileMinimumNotice minimum={minimum} estimatedWeightKg={2} />);
    expect(screen.getByText(/drop-off.*any amount/i)).toBeInTheDocument();
    expect(screen.getByText(/Keep bags dry/)).toBeInTheDocument();
  });

  it('does not show a minimum block when either estimate meets the minimum', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: 3,
      min_weight_kg: 5,
      guidance_text: null,
    };
    render(<TextileMinimumNotice minimum={minimum} estimatedBags={5} estimatedWeightKg={2} />);
    expect(screen.queryByText(/Below the pickup minimum/)).not.toBeInTheDocument();
    expect(screen.getByText(/meets the guidance/)).toBeInTheDocument();
  });

  it('does not apply the pickup minimum to drop-off', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: 10,
      min_weight_kg: 20,
      guidance_text: null,
    };
    render(
      <TextileMinimumNotice
        minimum={minimum}
        estimatedBags={1}
        estimatedWeightKg={1}
        collectionMethod="dropoff"
      />,
    );
    expect(screen.getByText(/No minimum for drop-off/)).toBeInTheDocument();
  });

  it('explains how to proceed when pickup is below minimum', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: 5,
      min_weight_kg: null,
      guidance_text: null,
    };
    render(<TextileMinimumNotice minimum={minimum} estimatedBags={1} />);
    expect(screen.getByText(/Add more bags, or choose drop-off/)).toBeInTheDocument();
  });
});

describe('isBelowMinimum helper', () => {
  it('returns false for dropoff regardless of estimate', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: 5,
      min_weight_kg: 5,
      guidance_text: null,
    };
    expect(isBelowMinimum(minimum, 1, 1, 'dropoff')).toBe(false);
  });

  it('returns false when minimum is null', () => {
    expect(isBelowMinimum(null, 1, 1, 'premises')).toBe(false);
  });

  it('returns false when no thresholds configured', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: null,
      min_weight_kg: null,
      guidance_text: null,
    };
    expect(isBelowMinimum(minimum, 1, 1, 'premises')).toBe(false);
  });

  it('returns true when bags below', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: 5,
      min_weight_kg: null,
      guidance_text: null,
    };
    expect(isBelowMinimum(minimum, 2, null, 'premises')).toBe(true);
    expect(isBelowMinimum(minimum, 5, null, 'premises')).toBe(false);
    expect(isBelowMinimum(minimum, 6, null, 'premises')).toBe(false);
  });

  it('returns true when weight below', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: null,
      min_weight_kg: 10,
      guidance_text: null,
    };
    expect(isBelowMinimum(minimum, null, 5, 'premises')).toBe(true);
  });

  it('accepts either configured minimum', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: 5,
      min_weight_kg: 10,
      guidance_text: null,
    };
    expect(isBelowMinimum(minimum, 2, 20, 'premises')).toBe(false);
    expect(isBelowMinimum(minimum, 10, 2, 'premises')).toBe(false);
    expect(isBelowMinimum(minimum, 2, 2, 'premises')).toBe(true);
    expect(isBelowMinimum(minimum, 10, 20, 'premises')).toBe(false);
  });

  it('handles null estimates without throwing', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: 5,
      min_weight_kg: 10,
      guidance_text: null,
    };
    expect(isBelowMinimum(minimum, null, null, 'premises')).toBe(false);
  });
});
