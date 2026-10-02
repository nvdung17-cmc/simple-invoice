import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import Grid from '@mui/material/Grid'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useQuery } from '@tanstack/react-query'
import { Link as RouterLink, useLocation, useParams } from 'react-router'
import { errorStatus } from '../../../api/errors'
import { getInvoice, invoiceKeys } from '../../../api/invoices'
import type { Invoice } from '../../../api/types'
import { ErrorState } from '../../../components/ErrorState'
import { PageHeader } from '../../../components/PageHeader'
import { SectionCard } from '../../../components/SectionCard'
import { StatusChip } from '../../../components/StatusChip'
import { formatDate, formatDateTime, formatMoney } from '../../../lib/format'
import type { InvoiceLinkState } from '../list/linkState'
import { DetailList } from './DetailList'

/**
 * One Invoice (spec §6.3), every value exactly as the API serves it. The back
 * link returns to the list as the User left it: the list passes its query
 * string in the location state.
 */
export function InvoiceDetailPage() {
  const { invoiceId = '' } = useParams()
  const location = useLocation()
  const listSearch = (location.state as Partial<InvoiceLinkState> | null)?.listSearch ?? ''
  const query = useQuery({
    queryKey: invoiceKeys.detail(invoiceId),
    queryFn: ({ signal }) => getInvoice(invoiceId, signal),
  })

  const backLink = (
    <Link
      component={RouterLink}
      to={`/invoices${listSearch}`}
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 1 }}
    >
      <ArrowBackIcon fontSize="small" />
      Back to invoices
    </Link>
  )

  if (query.isPending) {
    return (
      <Stack spacing={2} role="status" aria-label="Loading invoice">
        {backLink}
        <Skeleton variant="text" width={260} sx={{ fontSize: '2.5rem' }} />
        <Grid container spacing={2}>
          {[6, 6, 8, 4].map((size, index) => (
            <Grid key={index} size={{ xs: 12, md: size }}>
              <Skeleton variant="rounded" height={220} />
            </Grid>
          ))}
        </Grid>
      </Stack>
    )
  }

  if (query.isError) {
    const status = errorStatus(query.error)
    // The API answers 400 to an id that is not a UUID: to the User, that is a missing Invoice too.
    if (status === 404 || status === 400) {
      return (
        <>
          <PageHeader title="Invoice not found" back={backLink} />
          <Typography>
            There is no invoice at this address. Check the link, or go back to the list.
          </Typography>
        </>
      )
    }
    return (
      <>
        <PageHeader title="Invoice" back={backLink} />
        <ErrorState message="Could not load this invoice." onRetry={() => void query.refetch()} />
      </>
    )
  }

  const invoice = query.data
  return (
    <>
      <PageHeader
        title={invoice.invoiceNumber}
        back={backLink}
        chip={<StatusChip status={invoice.status} size="medium" />}
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title="Invoice">
            <DetailList
              items={[
                { label: 'Invoice number', value: invoice.invoiceNumber },
                { label: 'Reference', value: invoice.invoiceReference },
                { label: 'Invoice date', value: formatDate(invoice.invoiceDate) },
                { label: 'Due date', value: formatDate(invoice.dueDate) },
                { label: 'Currency', value: `${invoice.currency} (${invoice.currencySymbol})` },
                { label: 'Description', value: invoice.description },
                { label: 'Created at', value: formatDateTime(invoice.createdAt) },
              ]}
            />
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title="Customer">
            <DetailList
              items={[
                { label: 'Name', value: invoice.customer.fullname },
                {
                  label: 'Email',
                  value: (
                    <Link href={`mailto:${invoice.customer.email}`}>{invoice.customer.email}</Link>
                  ),
                },
                { label: 'Mobile', value: invoice.customer.mobileNumber },
                { label: 'Address', value: invoice.customer.address },
              ]}
            />
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <SectionCard title="Invoice items">
            <ItemsTable invoice={invoice} />
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SectionCard title="Summary">
            <DetailList
              amounts
              items={[
                { label: 'Sub-total', value: money(invoice, invoice.invoiceSubTotal) },
                { label: `Tax (${invoice.taxRate}%)`, value: money(invoice, invoice.totalTax) },
                { label: 'Discount', value: money(invoice, -invoice.totalDiscount) },
                { label: 'Total amount', value: money(invoice, invoice.totalAmount) },
                { label: 'Total paid', value: money(invoice, invoice.totalPaid) },
                { label: 'Balance', value: money(invoice, invoice.balanceAmount), emphasis: true },
              ]}
            />
          </SectionCard>
        </Grid>
      </Grid>
    </>
  )
}

const money = (invoice: Invoice, amount: number) => formatMoney(amount, invoice.currencySymbol)

function ItemsTable({ invoice }: { invoice: Invoice }) {
  return (
    <TableContainer>
      <Table
        size="small"
        aria-label="Invoice items"
        sx={{ '& .MuiTableCell-root': { px: { xs: 0.5, sm: 2 } } }}
      >
        <TableHead>
          <TableRow>
            <TableCell>Item</TableCell>
            <TableCell align="right">Quantity</TableCell>
            <TableCell align="right">Rate</TableCell>
            <TableCell align="right">Amount</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invoice.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell sx={{ overflowWrap: 'break-word' }}>{item.name}</TableCell>
              <TableCell align="right">{item.quantity}</TableCell>
              <TableCell align="right">{money(invoice, item.rate)}</TableCell>
              <TableCell align="right">{money(invoice, item.amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
