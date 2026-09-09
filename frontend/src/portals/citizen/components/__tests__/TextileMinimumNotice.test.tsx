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
    expect(screen.getByText(/No pickup minimum is set for your area/)).toBeInTheDocument();
  });

  it('shows empty state when only a bag minimum is configured (weight-only rule)', () => {
    // #14: min_bags is kept for records but never enforced or advertised.
    render(
      <TextileMinimumNotice
        minimum={{
          service_zone_id: 'z1',
          min_bags: 5,
          min_weight_kg: null,
          guidance_text: null,
        }}
      />,
    );
    expect(screen.getByText(/No pickup minimum is set for your area/)).toBeInTheDocument();
  });

  it('renders weight-only minimum with guidance text', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: 5,
      min_weight_kg: 4,
      guidance_text: 'Keep bags dry.',
    };
    render(<TextileMinimumNotice minimum={minimum} estimatedBags={60} estimatedWeightKg={12} />);
    expect(screen.getByText(/4 kg/)).toBeInTheDocument();
    expect(screen.getByText(/Keep bags dry/)).toBeInTheDocument();
    expect(screen.getByText(/Your estimate meets the guidance/)).toBeInTheDocument();
  });

  it('renders minimum without guidance fallback', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: null,
      min_weight_kg: 4,
      guidance_text: null,
    };
    render(<TextileMinimumNotice minimum={minimum} estimatedWeightKg={5} />);
    expect(screen.getByText(/4 kg/)).toBeInTheDocument();
    expect(screen.getByText(/only weight counts toward the pickup minimum/)).toBeInTheDocument();
  });

  it('blocks home pickup guidance when below minimum by weight', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: null,
      min_weight_kg: 4,
      guidance_text: null,
    };
    render(
      <TextileMinimumNotice
        minimum={minimum}
        estimatedWeightKg={2}
        isLoading={false}
        isError={false}
      />,
    );
    expect(screen.getByText(/Below the pickup minimum/)).toBeInTheDocument();
    expect(screen.getByText(/Home pickup needs at least 4 kg/)).toBeInTheDocument();
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

  it('lets any bag count pass when no weight is entered', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: 50,
      min_weight_kg: 4,
      guidance_text: null,
    };
    render(<TextileMinimumNotice minimum={minimum} estimatedBags={1} />);
    expect(screen.queryByText(/Below the pickup minimum/)).not.toBeInTheDocument();
    expect(screen.getByText(/meets the guidance/)).toBeInTheDocument();
  });

  it('does not show a minimum block when the weight meets the minimum', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: 50,
      min_weight_kg: 4,
      guidance_text: null,
    };
    render(<TextileMinimumNotice minimum={minimum} estimatedBags={1} estimatedWeightKg={4} />);
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
      min_bags: null,
      min_weight_kg: 4,
      guidance_text: null,
    };
    render(<TextileMinimumNotice minimum={minimum} estimatedWeightKg={1} />);
    expect(screen.getByText(/Add more weight, or choose drop-off/)).toBeInTheDocument();
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

  it('returns false when no weight threshold configured', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: 5,
      min_weight_kg: null,
      guidance_text: null,
    };
    expect(isBelowMinimum(minimum, 1, 1, 'premises')).toBe(false);
  });

  it('ignores the bag count entirely (weight-only rule)', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: 50,
      min_weight_kg: 4,
      guidance_text: null,
    };
    // One bag would fail the old bags rule but passes now.
    expect(isBelowMinimum(minimum, 1, null, 'premises')).toBe(false);
    expect(isBelowMinimum(minimum, 0, null, 'premises')).toBe(false);
  });

  it('returns true when weight below, false when weight meets the minimum', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: null,
      min_weight_kg: 4,
      guidance_text: null,
    };
    expect(isBelowMinimum(minimum, null, 3, 'premises')).toBe(true);
    expect(isBelowMinimum(minimum, null, 4, 'premises')).toBe(false);
    expect(isBelowMinimum(minimum, null, 6, 'premises')).toBe(false);
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
