import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TextileMinimumNotice, isBelowMinimum } from '../TextileMinimumNotice';
import type { TextileCapacityMinimum } from '../../api/textileZones';

describe('TextileMinimumNotice', () => {
  it('shows loading state', () => {
    render(<TextileMinimumNotice isLoading minimum={null} />);
    expect(screen.getByText(/Loading this partner/)).toBeInTheDocument();
  });

  it('shows error state with alert and retry', () => {
    const onRetry = vi.fn();
    render(<TextileMinimumNotice isError minimum={null} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Could not load minimum/);
    const btn = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows error state without retry when onRetry not provided', () => {
    render(<TextileMinimumNotice isError minimum={null} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry/i })).not.toBeInTheDocument();
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
    expect(screen.getByText(/has not configured a minimum/)).toBeInTheDocument();
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
    expect(screen.getByText(/never silently rejected/)).toBeInTheDocument();
  });

  it('shows exception CTA when below minimum by bags', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: 5,
      min_weight_kg: null,
      guidance_text: null,
    };
    const onRequestException = vi.fn();
    render(
      <TextileMinimumNotice
        minimum={minimum}
        estimatedBags={2}
        isLoading={false}
        isError={false}
        onRequestException={onRequestException}
      />,
    );
    expect(screen.getByText(/Your estimate is below the partner minimum/)).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /Request exception/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onRequestException).toHaveBeenCalledTimes(1);
  });

  it('shows exception CTA when below minimum by weight', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: null,
      min_weight_kg: 10,
      guidance_text: 'Urgent exceptions allowed.',
    };
    render(
      <TextileMinimumNotice minimum={minimum} estimatedWeightKg={2} onRequestException={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /Request exception/i })).toBeInTheDocument();
    expect(screen.getByText(/Urgent exceptions allowed/)).toBeInTheDocument();
  });

  it('does not show exception CTA when estimate meets minimum', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: 3,
      min_weight_kg: 5,
      guidance_text: null,
    };
    render(
      <TextileMinimumNotice
        minimum={minimum}
        estimatedBags={5}
        estimatedWeightKg={6}
        onRequestException={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Request exception/i })).not.toBeInTheDocument();
    expect(screen.getByText(/meets the guidance/)).toBeInTheDocument();
  });

  it('does not show exception CTA when collection method is dropoff', () => {
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
        onRequestException={vi.fn()}
      />,
    );
    expect(screen.getByText(/No minimum — drop off any amount/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Request exception/i })).not.toBeInTheDocument();
  });

  it('does not show CTA when onRequestException not provided even if below minimum', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: 5,
      min_weight_kg: null,
      guidance_text: null,
    };
    render(<TextileMinimumNotice minimum={minimum} estimatedBags={1} />);
    expect(screen.getByText(/Your estimate is below/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Request exception/i })).not.toBeInTheDocument();
  });

  it('never silently rejects — always shows explanatory copy', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: 5,
      min_weight_kg: null,
      guidance_text: null,
    };
    render(
      <TextileMinimumNotice minimum={minimum} estimatedBags={1} onRequestException={vi.fn()} />,
    );
    expect(screen.getByText(/We never silently reject/)).toBeInTheDocument();
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

  it('returns true when either dimension below', () => {
    const minimum: TextileCapacityMinimum = {
      service_zone_id: 'z1',
      min_bags: 5,
      min_weight_kg: 10,
      guidance_text: null,
    };
    expect(isBelowMinimum(minimum, 2, 20, 'premises')).toBe(true);
    expect(isBelowMinimum(minimum, 10, 2, 'premises')).toBe(true);
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
