import { Decimal } from 'decimal.js';
import type { ValueTransformer } from 'typeorm';

/**
 * Maps NUMERIC columns to Decimal. The pg driver returns NUMERIC as a string to
 * avoid float rounding; Decimal keeps that exactness in the domain code.
 */
export const decimalTransformer: ValueTransformer = {
  to: (value?: Decimal | string | null) =>
    value === undefined || value === null
      ? value
      : new Decimal(value).toFixed(2),
  from: (value: string | null) => (value === null ? null : new Decimal(value)),
};
