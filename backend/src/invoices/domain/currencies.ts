/**
 * Supported Currencies and their symbols. Only ISO 4217 codes with 2 decimal
 * places are listed, because every amount is stored as NUMERIC(15,2).
 * The frontend mirrors this list in frontend/src/lib/currencies.ts; this file
 * is the source of truth.
 */
export const CURRENCY_SYMBOLS = {
  AUD: 'AU$',
  USD: 'US$',
  GBP: '£',
  EUR: '€',
  SGD: 'S$',
  NZD: 'NZ$',
  CAD: 'CA$',
  HKD: 'HK$',
} as const;

export type CurrencyCode = keyof typeof CURRENCY_SYMBOLS;

export const CURRENCY_CODES = Object.keys(CURRENCY_SYMBOLS) as CurrencyCode[];
