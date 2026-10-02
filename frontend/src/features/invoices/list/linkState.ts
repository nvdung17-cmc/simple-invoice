/**
 * Location state carried from the list to an Invoice's detail page: the
 * list's query string, so "Back to invoices" returns to the same page,
 * filters and sort (spec §6.3).
 */
export interface InvoiceLinkState {
  listSearch: string
}
