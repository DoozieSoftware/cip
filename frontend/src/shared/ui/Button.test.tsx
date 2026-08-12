import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('keeps a disabled primary action visibly styled', () => {
    render(<Button disabled>Escalate</Button>);

    expect(screen.getByRole('button', { name: 'Escalate' })).toHaveClass(
      'bg-[var(--color-ink)]',
      'disabled:bg-[var(--color-text-tertiary)]',
      'text-white',
    );
  });
});
