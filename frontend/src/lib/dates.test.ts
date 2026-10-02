import { addDaysIso, isIsoDate, todayIsoDate } from './dates'

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

describe('isIsoDate', () => {
  it.each(['2026-06-03', '2028-02-29', '2026-12-31'])('accepts %s', (value) => {
    expect(isIsoDate(value)).toBe(true)
  })

  it.each(['2026-02-30', '2027-02-29', '2026-13-01', '2026-6-3', '03/06/2026', ''])(
    'rejects %j',
    (value) => {
      expect(isIsoDate(value)).toBe(false)
    },
  )
})
