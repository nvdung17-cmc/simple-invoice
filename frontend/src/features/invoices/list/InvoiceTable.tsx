import Link from '@mui/material/Link'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import { Link as RouterLink, useNavigate } from 'react-router'
import type { Invoice, Paging, SortField, SortOrder } from '../../../api/types'
import { StatusChip } from '../../../components/StatusChip'
import { formatDate, formatMoney } from '../../../lib/format'
import { PAGE_SIZES } from '../listParams'
import type { InvoiceLinkState } from './linkState'

export interface InvoiceTableProps {
  invoices: Invoice[]
  paging: Paging
  sortBy?: SortField
  ordering: SortOrder
  linkState: InvoiceLinkState
  onSort: (field: SortField) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

/**
 * The desktop Invoice list (spec §6.3). The Invoice Number is a real link for
 * keyboards and screen readers; a click anywhere on the row does the same.
 */
export function InvoiceTable({
  invoices,
  paging,
  sortBy,
  ordering,
  linkState,
  onSort,
  onPageChange,
  onPageSizeChange,
}: InvoiceTableProps) {
  const navigate = useNavigate()
  const direction = ordering === 'ASC' ? 'asc' : 'desc'

  const sortableHeader = (field: SortField, label: string, align?: 'right') => (
    <TableCell align={align} sortDirection={sortBy === field ? direction : false}>
      <TableSortLabel
        active={sortBy === field}
        direction={sortBy === field ? direction : 'asc'}
        onClick={() => onSort(field)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  )

  return (
    <>
      <TableContainer>
        <Table aria-label="Invoices">
          <TableHead>
            <TableRow>
              <TableCell>Invoice number</TableCell>
              <TableCell>Customer</TableCell>
              {sortableHeader('invoiceDate', 'Invoice date')}
              {sortableHeader('dueDate', 'Due date')}
              {sortableHeader('totalAmount', 'Total', 'right')}
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices.map((invoice) => {
              const detailPath = `/invoices/${invoice.invoiceId}`
              return (
                <TableRow
                  key={invoice.invoiceId}
                  hover
                  onClick={() => navigate(detailPath, { state: linkState })}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Link
                      component={RouterLink}
                      to={detailPath}
                      state={linkState}
                      onClick={(event) => event.stopPropagation()}
                      sx={{ fontWeight: 500 }}
                    >
                      {invoice.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{invoice.customer.fullname}</TableCell>
                  <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                  <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                  <TableCell align="right">
                    {formatMoney(invoice.totalAmount, invoice.currencySymbol)}
                  </TableCell>
                  <TableCell>
                    <StatusChip status={invoice.status} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={paging.total}
        page={paging.page - 1}
        rowsPerPage={paging.pageSize}
        rowsPerPageOptions={PAGE_SIZES}
        onPageChange={(_event, page) => onPageChange(page + 1)}
        onRowsPerPageChange={(event) => onPageSizeChange(Number(event.target.value))}
        showFirstButton
        showLastButton
      />
    </>
  )
}
