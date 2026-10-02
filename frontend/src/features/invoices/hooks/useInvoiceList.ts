import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { invoiceKeys, listInvoices } from '../../../api/invoices'
import type { InvoiceListQuery } from '../../../api/types'

/**
 * One page of the Invoice list. While the next page or filter loads, the
 * previous rows stay on screen, so the table does not flash empty.
 */
export function useInvoiceList(params: InvoiceListQuery) {
  return useQuery({
    queryKey: invoiceKeys.list(params),
    queryFn: ({ signal }) => listInvoices(params, signal),
    placeholderData: keepPreviousData,
  })
}
