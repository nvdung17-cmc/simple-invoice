import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import type { SortField, SortOrder } from '../../../api/types'
import {
  hasActiveFilters,
  SORT_FIELDS,
  STATUS_OPTIONS,
  type InvoiceListParams,
} from '../listParams'

/** "Date created" is the API's own order, so choosing it sends no `sortBy` at all. */
const DATE_CREATED = 'createdAt'

const SORT_OPTIONS = [
  { value: DATE_CREATED, label: 'Date created' },
  { value: 'invoiceDate', label: 'Invoice date' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'totalAmount', label: 'Total amount' },
] satisfies Array<{ value: SortField | typeof DATE_CREATED; label: string }>

/**
 * The list's Status, sort and Invoice-date controls (spec §6.3). They show
 * `params` and report each change through `onChange`; the page writes it to
 * the URL.
 */
export function InvoiceFilters({
  params,
  onChange,
  onClear,
}: {
  params: InvoiceListParams
  onChange: (changes: Partial<InvoiceListParams>) => void
  onClear: () => void
}) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      useFlexGap
      sx={{ flexWrap: 'wrap', alignItems: { md: 'center' } }}
    >
      <TextField
        select
        label="Status"
        size="small"
        value={params.status ?? ''}
        onChange={(event) =>
          onChange({ status: STATUS_OPTIONS.find((status) => status === event.target.value) })
        }
        slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        sx={{ minWidth: 140 }}
      >
        <MenuItem value="">All</MenuItem>
        {STATUS_OPTIONS.map((status) => (
          <MenuItem key={status} value={status}>
            {status}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Sort by"
        size="small"
        value={params.sortBy ?? DATE_CREATED}
        onChange={(event) =>
          onChange({ sortBy: SORT_FIELDS.find((field) => field === event.target.value) })
        }
        sx={{ minWidth: 160 }}
      >
        {SORT_OPTIONS.map(({ value, label }) => (
          <MenuItem key={value} value={value}>
            {label}
          </MenuItem>
        ))}
      </TextField>
      <ToggleButtonGroup
        exclusive
        size="small"
        aria-label="Sort order"
        value={params.ordering}
        onChange={(_event, ordering: SortOrder | null) => {
          // Clicking the selected button again reports null; the order stays.
          if (ordering) onChange({ ordering })
        }}
      >
        <ToggleButton value="ASC" aria-label="Ascending">
          <ArrowUpwardIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton value="DESC" aria-label="Descending">
          <ArrowDownwardIcon fontSize="small" />
        </ToggleButton>
      </ToggleButtonGroup>
      <TextField
        type="date"
        label="Invoice date from"
        size="small"
        value={params.fromDate ?? ''}
        onChange={(event) => onChange({ fromDate: event.target.value || undefined })}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: params.toDate } }}
      />
      <TextField
        type="date"
        label="Invoice date to"
        size="small"
        value={params.toDate ?? ''}
        onChange={(event) => onChange({ toDate: event.target.value || undefined })}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: params.fromDate } }}
      />
      <Button onClick={onClear} disabled={!hasActiveFilters(params)}>
        Clear filters
      </Button>
    </Stack>
  )
}
