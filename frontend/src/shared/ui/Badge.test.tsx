import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>pending</Badge>);
    expect(screen.getByText('pending')).toBeInTheDocument();
  });
  it('uses a danger tone when requested', () => {
    render(<Badge tone="danger">high</Badge>);
    const el = screen.getByText('high');
    expect(el.className).toContain('text-red-700');
  });
});
