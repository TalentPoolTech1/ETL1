import { describe, expect, it } from 'vitest';
import { cx } from './cx';

describe('cx', () => {
  it('joins plain class names', () => {
    expect(cx('a', 'b', 'c')).toBe('a b c');
  });

  it('supports conditional object flags', () => {
    expect(cx('base', { active: true, hidden: false }, null, undefined, false)).toBe('base active');
  });
});
