import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation, useNavigationType } from 'react-router'
import { useInvoiceListParams } from './useInvoiceListParams'

function setup(entry: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
  )
  return renderHook(
    () => ({
      ...useInvoiceListParams(),
      search: useLocation().search,
      navigationType: useNavigationType(),
    }),
    { wrapper },
  )
}

describe('useInvoiceListParams', () => {
  it('reads the list state from the URL', () => {
    const { result } = setup('/invoices?page=3&status=Paid')

    expect(result.current.params).toEqual({
      page: 3,
      pageSize: 10,
      ordering: 'DESC',
      status: 'Paid',
    })
  })

  it('goes back to page 1 when a filter changes', () => {
    const { result } = setup('/invoices?page=3&pageSize=20')

    act(() => result.current.update({ status: 'Overdue' }))

    expect(result.current.search).toBe('?pageSize=20&status=Overdue')
    expect(result.current.navigationType).toBe('PUSH')
  })

  it('keeps the filters when only the page changes', () => {
    const { result } = setup('/invoices?status=Paid')

    act(() => result.current.update({ page: 2 }))

    expect(result.current.search).toBe('?page=2&status=Paid')
  })

  it('can replace the history entry instead of adding one', () => {
    const { result } = setup('/invoices')

    act(() => result.current.update({ keyword: 'IV178' }, { replace: true }))

    expect(result.current.search).toBe('?keyword=IV178')
    expect(result.current.navigationType).toBe('REPLACE')
  })

  it('clears the filters but keeps the sort and page size', () => {
    const { result } = setup(
      '/invoices?page=2&pageSize=50&sortBy=dueDate&ordering=ASC&status=Paid' +
        '&keyword=Kanglee&fromDate=2026-01-01&toDate=2026-06-30',
    )

    act(() => result.current.clearFilters())

    expect(result.current.search).toBe('?pageSize=50&sortBy=dueDate&ordering=ASC')
  })
})
