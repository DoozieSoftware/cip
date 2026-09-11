import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RequiredMark } from './RequiredMark';

describe('RequiredMark', () => {
  it('renders a decorative red asterisk beside the label', () => {
    render(
      <div>
        <label htmlFor="demo">Your name</label>
        <RequiredMark />
        <input id="demo" />
      </div>,
    );

    const star = screen.getByText('*', { selector: 'span[aria-hidden="true"]' });
    expect(star.className).toMatch(/text-red-600/);
    expect(screen.getByLabelText('Your name')).toBeInTheDocument();
  });
});
