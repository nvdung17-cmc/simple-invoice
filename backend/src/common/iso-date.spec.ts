import { addDays, isIsoDate, todayIn } from './iso-date.js';

describe('todayIn', () => {
  const instant = new Date('2026-06-30T17:30:00.000Z');

  it('returns the calendar date in the given time zone', () => {
    expect(todayIn('UTC', instant)).toBe('2026-06-30');
    expect(todayIn('Asia/Ho_Chi_Minh', instant)).toBe('2026-07-01');
    expect(todayIn('America/Los_Angeles', instant)).toBe('2026-06-30');
  });
});

describe('addDays', () => {
  it('adds and subtracts whole days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-06-03', 30)).toBe('2026-07-03');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('isIsoDate', () => {
  it.each(['2026-06-03', '2028-02-29', '2026-12-31'])('accepts %s', (value) => {
    expect(isIsoDate(value)).toBe(true);
  });

  it.each([
    '2026-02-30',
    '2027-02-29',
    '2026-13-01',
    '2026-6-3',
    '03/06/2026',
    '',
    20260603,
    null,
  ])('rejects %s', (value) => {
    expect(isIsoDate(value)).toBe(false);
  });
});
