import { http } from './http'
import type { CreateInvoiceRequest, Invoice, InvoiceListQuery, InvoiceListResponse } from './types'

/**
 * Invoice endpoints (spec §5.3) and their TanStack Query keys. Every key
 * starts with `invoiceKeys.all`, so one invalidation refreshes every list and
 * detail after an Invoice is created.
 */
export const invoiceKeys = {
  all: ['invoices'] as const,
  list: (query: InvoiceListQuery) => [...invoiceKeys.all, 'list', query] as const,
  detail: (invoiceId: string) => [...invoiceKeys.all, 'detail', invoiceId] as const,
}

/** One page of Invoices. axios leaves unset (undefined) filters out of the query string. */
export async function listInvoices(
  query: InvoiceListQuery,
  signal?: AbortSignal,
): Promise<InvoiceListResponse> {
  const { data } = await http.get<InvoiceListResponse>('/invoices', { params: query, signal })
  return data
}

export async function getInvoice(invoiceId: string, signal?: AbortSignal): Promise<Invoice> {
  const { data } = await http.get<Invoice>(`/invoices/${encodeURIComponent(invoiceId)}`, {
    signal,
  })
  return data
}

export async function createInvoice(body: CreateInvoiceRequest): Promise<Invoice> {
  const { data } = await http.post<Invoice>('/invoices', body)
  return data
}
