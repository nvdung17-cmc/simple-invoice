import SearchIcon from '@mui/icons-material/Search'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import { useEffect, useRef, useState } from 'react'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { KEYWORD_MAX_LENGTH } from '../listParams'

const SEARCH_DELAY_MS = 300

/**
 * The list's search box (spec §6.3). It searches once typing pauses, and it
 * shows the URL's keyword whenever that changes from elsewhere: Clear filters
 * or the browser's back button.
 */
export function SearchField({
  keyword,
  onSearch,
}: {
  keyword: string
  onSearch: (keyword: string) => void
}) {
  const [text, setText] = useState(keyword)
  const [shownKeyword, setShownKeyword] = useState(keyword)
  if (keyword !== shownKeyword) {
    setShownKeyword(keyword)
    // When our own search comes back, keep what is typed (a trailing space, say).
    if (keyword !== text.trim()) setText(keyword)
  }

  const pausedText = useDebouncedValue(text, SEARCH_DELAY_MS)
  const handledText = useRef(pausedText)
  useEffect(() => {
    // Search once per pause in typing; a keyword change from elsewhere is not a pause.
    if (pausedText === handledText.current) return
    handledText.current = pausedText
    const next = pausedText.trim()
    if (next !== keyword) onSearch(next)
  }, [pausedText, keyword, onSearch])

  return (
    <TextField
      type="search"
      label="Search"
      placeholder="Search invoice number or customer"
      value={text}
      onChange={(event) => setText(event.target.value)}
      fullWidth
      size="small"
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        },
        htmlInput: { maxLength: KEYWORD_MAX_LENGTH },
      }}
    />
  )
}
