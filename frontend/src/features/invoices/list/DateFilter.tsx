import TextField from '@mui/material/TextField'
import { useEffect, useRef, useState } from 'react'
import { isIsoDate } from '../../../lib/dates'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

const DATE_DELAY_MS = 500
/** Earlier dates are the first steps of a year being typed (`0202-01-01`), not Invoice dates. */
const EARLIEST_DATE = '1900-01-01'

/**
 * One of the list's Invoice-date boxes (spec §6.3). While the User types a
 * year, Chromium reports a date at every step (`0002-01-01`, then
 * `0202-01-01`, then `2026-01-01`), so a box that follows the URL on every
 * keystroke loses what is typed. This one keeps the typed text and updates the
 * URL once typing pauses on a complete date, or on an empty box. It shows the
 * URL's date whenever that changes from elsewhere, such as the browser's back
 * button. Text the URL never takes (a partial date) stays in the box until the
 * box is remounted, which is what Clear filters does.
 */
export function DateFilter({
  label,
  value,
  onCommit,
  min,
  max,
}: {
  label: string
  value: string | undefined
  onCommit: (date: string | undefined) => void
  min?: string
  max?: string
}) {
  const [text, setText] = useState(value ?? '')
  const [shownValue, setShownValue] = useState(value ?? '')
  if ((value ?? '') !== shownValue) {
    // The URL changed from elsewhere (the back button): show it.
    setShownValue(value ?? '')
    if ((value ?? '') !== text) setText(value ?? '')
  }

  const pausedText = useDebouncedValue(text, DATE_DELAY_MS)
  const handledText = useRef(pausedText)
  useEffect(() => {
    // Commit once per pause in typing, and only a complete date or an empty box.
    // A date change from elsewhere is not a pause.
    if (pausedText === handledText.current) return
    handledText.current = pausedText
    if (pausedText === '') {
      if (value !== undefined) onCommit(undefined)
    } else if (isIsoDate(pausedText) && pausedText >= EARLIEST_DATE && pausedText !== value) {
      onCommit(pausedText)
    }
  }, [pausedText, value, onCommit])

  return (
    <TextField
      type="date"
      label={label}
      size="small"
      value={text}
      onChange={(event) => setText(event.target.value)}
      slotProps={{ inputLabel: { shrink: true }, htmlInput: { min, max } }}
    />
  )
}
