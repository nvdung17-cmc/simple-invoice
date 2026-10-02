import Chip, { type ChipProps } from '@mui/material/Chip'
import type { InvoiceStatus } from '../api/types'

const STATUS_COLORS: Record<InvoiceStatus, ChipProps['color']> = {
  Draft: 'default',
  Pending: 'info',
  Paid: 'success',
  Overdue: 'error',
}

/** An Invoice's Status as a coloured chip. The text is always shown, so colour is never the only cue. */
export function StatusChip({
  status,
  size = 'small',
}: {
  status: InvoiceStatus
  size?: ChipProps['size']
}) {
  return <Chip label={status} color={STATUS_COLORS[status]} size={size} />
}
