import type { TransformFnParams } from 'class-transformer';
import {
  defaultIfBlank,
  trim,
  trimToUndefined,
  trimToUpperCase,
} from './transforms.js';

function run(
  transform: (params: TransformFnParams) => unknown,
  value: unknown,
): unknown {
  return transform({ value } as TransformFnParams);
}

/**
 * Runs a transform on a field the way class-transformer does: `sent` is what
 * the client sent (in `obj`), and `value` is that after a @Type conversion.
 */
function runOnField(
  transform: (params: TransformFnParams) => unknown,
  sent: unknown,
  value: unknown = sent,
): unknown {
  return transform({
    value,
    key: 'field',
    obj: { field: sent },
  } as TransformFnParams);
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

  it('defaultIfBlank gives the default for a blank value, also after a conversion to a number', () => {
    const page = defaultIfBlank(1);
    // @Type(() => Number) has already turned '' and '  ' into 0 when the transform runs.
    expect(runOnField(page, '', 0)).toBe(1);
    expect(runOnField(page, '  ', 0)).toBe(1);
  });

  it('defaultIfBlank keeps every other value, including a real 0', () => {
    const page = defaultIfBlank(1);
    expect(runOnField(page, '0', 0)).toBe(0);
    expect(runOnField(page, '3', 3)).toBe(3);
  });

  it('defaultIfBlank hands any other value to the given transform', () => {
    const ordering = defaultIfBlank('DESC', trimToUpperCase);
    expect(runOnField(ordering, ' asc ')).toBe('ASC');
    expect(runOnField(ordering, ' ')).toBe('DESC');
  });
});
