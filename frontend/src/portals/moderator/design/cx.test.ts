import { describe, it, expect } from 'vitest';
import { cx } from './cx';

describe('cx', () => {
  it('joins truthy string parts with a single space', () => {
    expect(cx('a', 'b', 'c')).toBe('a b c');
  });
  it('drops falsy values', () => {
    expect(cx('a', false, null, undefined, '', 'b')).toBe('a b');
  });
  it('keeps 0 as a value', () => {
    expect(cx('row-', 0)).toBe('row- 0');
  });
  it('flattens nested arrays', () => {
    expect(cx('a', ['b', false, 'c'])).toBe('a b c');
  });
});
