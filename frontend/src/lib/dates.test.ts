import { addDaysIso, todayIsoDate } from './dates'

describe('todayIsoDate', () => {
  it('returns the local calendar date as YYYY-MM-DD', () => {
    expect(todayIsoDate(new Date('2026-10-02T23:59:59Z'))).toBe('2026-10-02')
  })
})

describe('addDaysIso', () => {
  it('adds days across month and year ends', () => {
    expect(addDaysIso('2026-10-02', 30)).toBe('2026-11-01')
    expect(addDaysIso('2026-12-15', 30)).toBe('2027-01-14')
    expect(addDaysIso('2028-02-28', 1)).toBe('2028-02-29')
  })
})
