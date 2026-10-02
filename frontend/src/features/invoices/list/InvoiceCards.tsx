import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import MenuItem from '@mui/material/MenuItem'
import Pagination from '@mui/material/Pagination'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router'
import type { Invoice, Paging } from '../../../api/types'
import { StatusChip } from '../../../components/StatusChip'
import { formatDate, formatMoney } from '../../../lib/format'
import { PAGE_SIZES } from '../listParams'
import type { InvoiceLinkState } from './linkState'

/** The phone-sized Invoice list (spec §6.3): one card per Invoice, each card a link. */
export function InvoiceCards({
  invoices,
  paging,
  linkState,
  onPageChange,
  onPageSizeChange,
}: {
  invoices: Invoice[]
  paging: Paging
  linkState: InvoiceLinkState
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}) {
  const pageCount = Math.max(1, Math.ceil(paging.total / paging.pageSize))
  return (
    <>
      <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {invoices.map((invoice) => (
          <Card component="li" key={invoice.invoiceId} variant="outlined">
            <CardActionArea
              component={RouterLink}
              to={`/invoices/${invoice.invoiceId}`}
              state={linkState}
            >
              <CardContent>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}
                >
                  <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                    {invoice.invoiceNumber}
                  </Typography>
                  <StatusChip status={invoice.status} />
                </Stack>
                <Typography sx={{ color: 'text.secondary', mb: 1, overflowWrap: 'anywhere' }}>
                  {invoice.customer.fullname}
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ justifyContent: 'space-between', alignItems: 'flex-end' }}
                >
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {formatDate(invoice.invoiceDate)} · Due {formatDate(invoice.dueDate)}
                  </Typography>
                  <Typography sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {formatMoney(invoice.totalAmount, invoice.currencySymbol)}
                  </Typography>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Stack>
      <Stack
        direction="row"
        spacing={2}
        useFlexGap
        sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', mt: 2 }}
      >
        <Pagination
          count={pageCount}
          page={paging.page}
          siblingCount={0}
          onChange={(_event, page) => onPageChange(page)}
        />
        <TextField
          select
          label="Per page"
          size="small"
          value={paging.pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          sx={{ minWidth: 96 }}
        >
          {PAGE_SIZES.map((size) => (
            <MenuItem key={size} value={size}>
              {size}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
    </>
  )
}
