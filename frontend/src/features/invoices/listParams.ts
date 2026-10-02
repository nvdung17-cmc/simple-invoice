import { z } from 'zod'
import type { InvoiceListQuery, InvoiceStatus, SortField } from '../../api/types'
import { isIsoDate } from '../../lib/dates'

/**
 * The Invoice list's state lives in the URL query string (spec §6.3), so a
 * list can be bookmarked, shared and restored with the back button. This
 * module converts between the two. A value the API would reject (a typo, a
 * hand-edited URL) falls back to its default instead of breaking the page.
 */

export type InvoiceListParams = InvoiceListQuery

export const PAGE_SIZES: readonly number[] = [10, 20, 50, 100]
export const DEFAULT_PAGE_SIZE = 10
export const KEYWORD_MAX_LENGTH = 100
export const SORT_FIELDS = [
  'invoiceDate',
  'dueDate',
  'totalAmount',
] as const satisfies readonly SortField[]
export const STATUS_OPTIONS = [
  'Draft',
  'Pending',
  'Paid',
  'Overdue',
] as const satisfies readonly InvoiceStatus[]

const isoDate = z.string().refine(isIsoDate).optional().catch(undefined)

const paramsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce
    .number()
    .refine((size) => PAGE_SIZES.includes(size))
    .catch(DEFAULT_PAGE_SIZE),
  sortBy: z.enum(SORT_FIELDS).optional().catch(undefined),
  ordering: z.enum(['ASC', 'DESC']).catch('DESC'),
  status: z.enum(STATUS_OPTIONS).optional().catch(undefined),
  keyword: z
    .string()
    .trim()
    .max(KEYWORD_MAX_LENGTH)
    .transform((keyword) => keyword || undefined)
    .optional()
    .catch(undefined),
  fromDate: isoDate,
  toDate: isoDate,
})

export function parseListParams(searchParams: URLSearchParams): InvoiceListParams {
  const params = paramsSchema.parse(Object.fromEntries(searchParams))
  // The API rejects a range that ends before it starts; keep only its start.
  if (params.fromDate && params.toDate && params.toDate < params.fromDate) {
    params.toDate = undefined
  }
  return params
}

/** The URL for `params`: defaults are left out, so the plain list stays at `/invoices`. */
export function toSearchParams(params: InvoiceListParams): URLSearchParams {
  const search = new URLSearchParams()
  if (params.page !== 1) search.set('page', String(params.page))
  if (params.pageSize !== DEFAULT_PAGE_SIZE) search.set('pageSize', String(params.pageSize))
  if (params.sortBy) search.set('sortBy', params.sortBy)
  if (params.ordering !== 'DESC') search.set('ordering', params.ordering)
  if (params.status) search.set('status', params.status)
  if (params.keyword) search.set('keyword', params.keyword)
  if (params.fromDate) search.set('fromDate', params.fromDate)
  if (params.toDate) search.set('toDate', params.toDate)
  return search
}

/** True when the list is narrowed by a filter. Sorting and paging are not filters. */
export function hasActiveFilters(params: InvoiceListParams): boolean {
  return Boolean(params.status || params.keyword || params.fromDate || params.toDate)
}
