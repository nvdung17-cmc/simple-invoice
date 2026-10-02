import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { Invoice } from '../../../api/types'
import { appendixAInvoice, makeInvoice } from '../../../test/fixtures'
import { mockMatchMedia } from '../../../test/mockMatchMedia'
import { server } from '../../../test/msw/server'
import { renderApp } from '../../../test/renderApp'

/**
 * Serves `GET /api/invoices` from `invoices`, paged the way the API pages
 * them, and records the query of every request.
 */
function serveInvoices(invoices: Invoice[]) {
  const requests: Array<Record<string, string>> = []
  server.use(
    http.get('/api/invoices', ({ request }) => {
      const query = Object.fromEntries(new URL(request.url).searchParams)
      requests.push(query)
      const page = Number(query.page)
      const pageSize = Number(query.pageSize)
      return HttpResponse.json({
        data: invoices.slice((page - 1) * pageSize, page * pageSize),
        paging: { page, pageSize, total: invoices.length },
      })
    }),
  )
  return requests
}

const DEFAULT_QUERY = { page: '1', pageSize: '10', ordering: 'DESC' }
const manyInvoices = Array.from({ length: 25 }, (_, index) => makeInvoice(index + 1))

describe('InvoiceListPage', () => {
  it('shows the Invoices the API returns', async () => {
    const requests = serveInvoices([appendixAInvoice])
    renderApp('/invoices', { signedIn: true })

    const link = await screen.findByRole('link', { name: 'IV1780488206995' })
    const cells = within(link.closest('tr')!).getAllByRole('cell')
    expect(cells.map((cell) => cell.textContent)).toEqual([
      'IV1780488206995',
      'Paul',
      '03 Jun 2026',
      '03 Jul 2026',
      'AU$2,180.00',
      'Overdue',
    ])
    expect(screen.getByRole('heading', { level: 1, name: 'Invoices' })).toBeInTheDocument()
    expect(requests).toEqual([DEFAULT_QUERY])
  })

  it('searches once typing pauses', async () => {
    const requests = serveInvoices([appendixAInvoice])
    const user = userEvent.setup()
    const { router } = renderApp('/invoices', { signedIn: true })
    await screen.findByRole('link', { name: 'IV1780488206995' })

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'iv178')

    await waitFor(() => expect(requests.at(-1)).toEqual({ ...DEFAULT_QUERY, keyword: 'iv178' }))
    expect(requests.filter((query) => query.keyword)).toHaveLength(1)
    expect(router.state.location.search).toBe('?keyword=iv178')
  })

  it('filters by Status and starts again at page 1', async () => {
    const requests = serveInvoices(manyInvoices)
    const user = userEvent.setup()
    const { router } = renderApp('/invoices?page=2', { signedIn: true })
    await screen.findByRole('link', { name: 'INV-0011' })

    await user.click(screen.getByRole('combobox', { name: 'Status' }))
    await user.click(screen.getByRole('option', { name: 'Overdue' }))

    await waitFor(() => expect(requests.at(-1)).toEqual({ ...DEFAULT_QUERY, status: 'Overdue' }))
    expect(router.state.location.search).toBe('?status=Overdue')
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Overdue')
  })

  it('sorts by a column header and toggles the order', async () => {
    const requests = serveInvoices([appendixAInvoice])
    const user = userEvent.setup()
    renderApp('/invoices', { signedIn: true })

    await user.click(await screen.findByRole('button', { name: 'Total' }))

    await waitFor(() =>
      expect(requests.at(-1)).toEqual({ ...DEFAULT_QUERY, sortBy: 'totalAmount', ordering: 'ASC' }),
    )
    expect(screen.getByRole('columnheader', { name: 'Total' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveTextContent('Total amount')
    expect(screen.getByRole('button', { name: 'Ascending' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(screen.getByRole('button', { name: 'Total' }))

    await waitFor(() =>
      expect(requests.at(-1)).toEqual({ ...DEFAULT_QUERY, sortBy: 'totalAmount' }),
    )
    expect(screen.getByRole('columnheader', { name: 'Total' })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
  })

  it('pages through the results and changes the page size', async () => {
    const requests = serveInvoices(manyInvoices)
    const user = userEvent.setup()
    const { router } = renderApp('/invoices', { signedIn: true })
    await screen.findByRole('link', { name: 'INV-0001' })

    await user.click(screen.getByRole('button', { name: 'Go to next page' }))

    expect(await screen.findByRole('link', { name: 'INV-0011' })).toBeInTheDocument()
    expect(screen.getByText('11–20 of 25')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?page=2')

    await user.click(screen.getByRole('combobox', { name: 'Rows per page:' }))
    await user.click(screen.getByRole('option', { name: '20' }))

    expect(await screen.findByText('1–20 of 25')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?pageSize=20')
    expect(requests.at(-1)).toEqual({ ...DEFAULT_QUERY, pageSize: '20' })
  })

  it('restores every control from the URL', async () => {
    const requests = serveInvoices([appendixAInvoice])
    renderApp(
      '/invoices?pageSize=20&sortBy=dueDate&ordering=ASC&status=Overdue&keyword=Paul' +
        '&fromDate=2026-01-01&toDate=2026-12-31',
      { signedIn: true },
    )

    await screen.findByRole('link', { name: 'IV1780488206995' })
    expect(requests).toEqual([
      {
        page: '1',
        pageSize: '20',
        sortBy: 'dueDate',
        ordering: 'ASC',
        status: 'Overdue',
        keyword: 'Paul',
        fromDate: '2026-01-01',
        toDate: '2026-12-31',
      },
    ])
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('Paul')
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Overdue')
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveTextContent('Due date')
    expect(screen.getByRole('button', { name: 'Ascending' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText('Invoice date from')).toHaveValue('2026-01-01')
    expect(screen.getByLabelText('Invoice date to')).toHaveValue('2026-12-31')
    expect(screen.getByRole('combobox', { name: 'Rows per page:' })).toHaveTextContent('20')
  })

  it('clears the filters but keeps the sort', async () => {
    serveInvoices([appendixAInvoice])
    const user = userEvent.setup()
    const { router } = renderApp('/invoices?sortBy=dueDate&status=Paid&keyword=Paul', {
      signedIn: true,
    })
    await screen.findByRole('link', { name: 'IV1780488206995' })

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    await waitFor(() => expect(router.state.location.search).toBe('?sortBy=dueDate'))
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDisabled()
  })

  it('invites the User to create the first Invoice', async () => {
    renderApp('/invoices', { signedIn: true })

    expect(await screen.findByText('No invoices yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create invoice' })).toHaveAttribute(
      'href',
      '/invoices/new',
    )
  })

  it('offers to clear filters that match nothing', async () => {
    serveInvoices([])
    const user = userEvent.setup()
    const { router } = renderApp('/invoices?status=Paid', { signedIn: true })

    const emptyState = (await screen.findByText('No invoices match your filters')).parentElement!
    await user.click(within(emptyState).getByRole('button', { name: 'Clear filters' }))

    expect(await screen.findByText('No invoices yet')).toBeInTheDocument()
    expect(router.state.location.search).toBe('')
  })

  it('leads back to page 1 from a page past the end', async () => {
    const requests = serveInvoices([appendixAInvoice])
    const user = userEvent.setup()
    renderApp('/invoices?page=5', { signedIn: true })

    expect(await screen.findByText('This page is empty')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to page 1' }))

    expect(await screen.findByRole('link', { name: 'IV1780488206995' })).toBeInTheDocument()
    expect(requests.map((query) => query.page)).toEqual(['5', '1'])
  })

  it('shows an error with Retry when the list fails to load', async () => {
    let calls = 0
    server.use(
      http.get('/api/invoices', () => {
        calls += 1
        if (calls === 1) {
          return HttpResponse.json(
            { statusCode: 500, message: 'Internal server error', error: 'Internal Server Error' },
            { status: 500 },
          )
        }
        return HttpResponse.json({
          data: [appendixAInvoice],
          paging: { page: 1, pageSize: 10, total: 1 },
        })
      }),
    )
    const user = userEvent.setup()
    renderApp('/invoices', { signedIn: true })

    expect(await screen.findByText('Could not load invoices.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('link', { name: 'IV1780488206995' })).toBeInTheDocument()
  })

  it('opens an Invoice from its row and remembers the list', async () => {
    serveInvoices([appendixAInvoice])
    const user = userEvent.setup()
    const { router } = renderApp('/invoices?status=Overdue', { signedIn: true })

    await user.click(await screen.findByRole('cell', { name: 'Paul' }))

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/invoices/${appendixAInvoice.invoiceId}`),
    )
    expect(router.state.location.state).toEqual({ listSearch: '?status=Overdue' })
  })

  it('shows cards, a filter panel and simple paging on a phone', async () => {
    mockMatchMedia(390)
    const requests = serveInvoices(manyInvoices)
    const user = userEvent.setup()
    renderApp('/invoices', { signedIn: true })

    const card = await screen.findByRole('link', { name: /INV-0001/ })
    expect(card).toHaveTextContent('Customer 0001')
    expect(card).toHaveTextContent('AU$2,180.00')
    expect(card).toHaveAttribute('href', `/invoices/${manyInvoices[0].invoiceId}`)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    const filtersButton = screen.getByRole('button', { name: 'Filters' })
    expect(filtersButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument()
    await user.click(filtersButton)
    expect(filtersButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Go to page 2' }))

    expect(await screen.findByRole('link', { name: /INV-0011/ })).toBeInTheDocument()
    expect(requests.at(-1)).toEqual({ ...DEFAULT_QUERY, page: '2' })
  })
})
