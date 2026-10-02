import { formatDate, formatDateTime, formatMoney } from './format'

describe('formatMoney', () => {
  it.each([
    [2180, 'AU$', 'AU$2,180.00'],
    [1451.34, 'AU$', 'AU$1,451.34'],
    [0, 'US$', 'US$0.00'],
    [1234567.5, '€', '€1,234,567.50'],
    [-20, 'AU$', '-AU$20.00'],
  ])('formats %d with %s as %s', (amount, symbol, expected) => {
    expect(formatMoney(amount, symbol)).toBe(expected)
  })
})

describe('formatDate', () => {
  it('shows an ISO date as day, short month and year', () => {
    expect(formatDate('2026-06-03')).toBe('03 Jun 2026')
    expect(formatDate('2026-09-30')).toBe('30 Sep 2026')
    expect(formatDate('2026-12-31')).toBe('31 Dec 2026')
  })
})

describe('formatDateTime', () => {
  it('shows a timestamp in the local time zone (UTC in tests)', () => {
    expect(formatDateTime('2026-06-03T12:03:26.995Z')).toBe('03 Jun 2026, 12:03')
  })
})
