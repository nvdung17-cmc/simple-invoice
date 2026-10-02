/** Calendar-date helpers for form defaults. Dates are `YYYY-MM-DD` strings, as the API uses them. */

/** Today's date in the viewer's time zone. */
export function todayIsoDate(now: Date = new Date()): string {
  // Shift by the zone offset so the UTC fields equal the local ones.
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

/** Adds whole days to a date. Computed in UTC, so a daylight-saving change never skips a day. */
export function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
