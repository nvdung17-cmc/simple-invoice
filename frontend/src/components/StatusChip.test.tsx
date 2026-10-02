import { render, screen } from '@testing-library/react'
import type { InvoiceStatus } from '../api/types'
import { StatusChip } from './StatusChip'

describe('StatusChip', () => {
  it.each<[InvoiceStatus, string]>([
    ['Draft', 'MuiChip-colorDefault'],
    ['Pending', 'MuiChip-colorInfo'],
    ['Paid', 'MuiChip-colorSuccess'],
    ['Overdue', 'MuiChip-colorError'],
  ])('shows %s with its colour', (status, colorClass) => {
    render(<StatusChip status={status} />)
    expect(screen.getByText(status).closest('.MuiChip-root')).toHaveClass(colorClass)
  })
})
