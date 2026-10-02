/** Display formatting. Values are shown exactly as the API serves them; nothing is recalculated. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const amountFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const pad = (value: number) => String(value).padStart(2, '0')

/** `formatMoney(2180, 'AU$')` → `AU$2,180.00`. A negative amount puts the sign first: `-AU$20.00`. */
export function formatMoney(amount: number, symbol: string): string {
  const sign = amount < 0 ? '-' : ''
  return `${sign}${symbol}${amountFormat.format(Math.abs(amount))}`
}

/**
 * `formatDate('2026-06-03')` → `03 Jun 2026`. The ISO date is split, not parsed
 * into a Date, so the time zone can never shift the calendar day.
 */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day} ${MONTHS[Number(month) - 1]} ${year}`
}

/** A timestamp in the viewer's time zone: `03 Jun 2026, 12:03`. */
export function formatDateTime(isoDateTime: string): string {
  const date = new Date(isoDateTime)
  return `${pad(date.getDate())} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
