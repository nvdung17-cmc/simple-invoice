import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { parseListParams, toSearchParams, type InvoiceListParams } from '../listParams'

/**
 * The Invoice list's state, read from and written to the URL (spec §6.3).
 * Any change other than the page itself starts again at page 1, because the
 * old page number means nothing for a new filter or sort.
 */
export function useInvoiceListParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => parseListParams(searchParams), [searchParams])

  const update = useCallback(
    (changes: Partial<InvoiceListParams>, { replace = false }: { replace?: boolean } = {}) => {
      const next = { ...params, ...changes }
      if (!('page' in changes)) next.page = 1
      setSearchParams(toSearchParams(next), { replace })
    },
    [params, setSearchParams],
  )

  const clearFilters = useCallback(() => {
    const { pageSize, sortBy, ordering } = params
    setSearchParams(toSearchParams({ page: 1, pageSize, sortBy, ordering }))
  }, [params, setSearchParams])

  return { params, update, clearFilters }
}
