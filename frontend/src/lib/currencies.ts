/**
 * The supported Currencies and their symbols, for the create form. The backend
 * owns the list (backend/src/invoices/domain/currencies.ts) and derives the
 * symbol itself; keep this copy in step with it.
 */
export const CURRENCIES = [
  { code: 'AUD', symbol: 'AU$' },
  { code: 'USD', symbol: 'US$' },
  { code: 'GBP', symbol: '£' },
  { code: 'EUR', symbol: '€' },
  { code: 'SGD', symbol: 'S$' },
  { code: 'NZD', symbol: 'NZ$' },
  { code: 'CAD', symbol: 'CA$' },
  { code: 'HKD', symbol: 'HK$' },
] as const

export type CurrencyCode = (typeof CURRENCIES)[number]['code']

export const CURRENCY_CODES = CURRENCIES.map(({ code }) => code) as [
  CurrencyCode,
  ...CurrencyCode[],
]
