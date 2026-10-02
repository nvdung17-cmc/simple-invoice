import type { TransformFnParams } from 'class-transformer';
import { trim, trimToUndefined, trimToUpperCase } from './transforms.js';

function run(
  transform: (params: TransformFnParams) => unknown,
  value: unknown,
): unknown {
  return transform({ value } as TransformFnParams);
}

describe('transforms', () => {
  it('trim removes surrounding whitespace and leaves other types alone', () => {
    expect(run(trim, '  Paul  ')).toBe('Paul');
    expect(run(trim, 42)).toBe(42);
  });

  it('trimToUndefined turns a blank string into undefined', () => {
    expect(run(trimToUndefined, '   ')).toBeUndefined();
    expect(run(trimToUndefined, ' Singapore ')).toBe('Singapore');
    expect(run(trimToUndefined, null)).toBeNull();
  });

  it('trimToUpperCase trims and upper-cases strings only', () => {
    expect(run(trimToUpperCase, ' aud ')).toBe('AUD');
    expect(run(trimToUpperCase, undefined)).toBeUndefined();
  });
});
