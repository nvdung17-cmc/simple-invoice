import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { Invoice } from '../../../api/types'
import { appendixAInvoice, makeInvoice } from '../../../test/fixtures'
import { server } from '../../../test/msw/server'
import { renderApp } from '../../../test/renderApp'

function serveInvoice(invoice: Invoice) {
  server.use(http.get(`/api/invoices/${invoice.invoiceId}`, () => HttpResponse.json(invoice)))
}

/** The label → value pairs of the card titled `title`. */
function detailsOf(title: string) {
  const section = screen.getByRole('region', { name: title })
  return Object.fromEntries(
    Array.from(section.querySelectorAll('dt'), (term) => [
      term.textContent,
      term.nextElementSibling?.textContent,
    ]),
  )
}

const detailPath = `/invoices/${appendixAInvoice.invoiceId}`

describe('InvoiceDetailPage', () => {
  it('shows every section and amount exactly as served', async () => {
    serveInvoice(appendixAInvoice)
    renderApp(detailPath, { signedIn: true })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'IV1780488206995' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(detailsOf('Invoice')).toEqual({
      'Invoice number': 'IV1780488206995',
      Reference: '#5721662',
      'Invoice date': '03 Jun 2026',
      'Due date': '03 Jul 2026',
      Currency: 'AUD (AU$)',
      Description: 'Invoice is issued to Kanglee',
      'Created at': '03 Jun 2026, 12:03',
    })
    expect(detailsOf('Customer')).toEqual({
      Name: 'Paul',
      Email: 'paul@101digital.io',
      Mobile: '947717364111',
      Address: 'Singapore',
    })
    expect(screen.getByRole('link', { name: 'paul@101digital.io' })).toHaveAttribute(
      'href',
      'mailto:paul@101digital.io',
    )
    const rows = within(screen.getByRole('table', { name: 'Invoice items' })).getAllByRole('row')
    expect(rows.map((row) => Array.from(row.children, (cell) => cell.textContent))).toEqual([
      ['Item', 'Quantity', 'Rate', 'Amount'],
      ['Honda RC150', '2', 'AU$1,000.00', 'AU$2,000.00'],
    ])
    expect(detailsOf('Summary')).toEqual({
      'Sub-total': 'AU$2,000.00',
      'Tax (10%)': 'AU$200.00',
      Discount: '-AU$20.00',
      'Total amount': 'AU$2,180.00',
      'Total paid': 'AU$1,451.34',
      Balance: 'AU$728.66',
    })
  })

  it('shows a dash for each empty optional field', async () => {
    const invoice = makeInvoice(1, {
      invoiceReference: null,
      description: null,
      customer: {
        fullname: 'Paul',
        email: 'paul@101digital.io',
        mobileNumber: null,
        address: null,
      },
    })
    serveInvoice(invoice)
    renderApp(`/invoices/${invoice.invoiceId}`, { signedIn: true })

    await screen.findByRole('heading', { level: 1, name: 'INV-0001' })
    expect(detailsOf('Invoice')).toMatchObject({ Reference: '—', Description: '—' })
    expect(detailsOf('Customer')).toMatchObject({ Mobile: '—', Address: '—' })
  })

  it('goes back to the list the User came from', async () => {
    serveInvoice(appendixAInvoice)
    const user = userEvent.setup()
    const { router } = renderApp(
      { pathname: detailPath, state: { listSearch: '?page=2&status=Overdue' } },
      { signedIn: true },
    )

    // The page shows the link while loading too; click the one on the loaded page.
    await screen.findByRole('heading', { level: 1, name: 'IV1780488206995' })
    await user.click(screen.getByRole('link', { name: 'Back to invoices' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/invoices'))
    expect(router.state.location.search).toBe('?page=2&status=Overdue')
  })

  it('links back to the whole list when opened directly', async () => {
    serveInvoice(appendixAInvoice)
    renderApp(detailPath, { signedIn: true })

    await screen.findByRole('heading', { level: 1, name: 'IV1780488206995' })
    expect(screen.getByRole('link', { name: 'Back to invoices' })).toHaveAttribute(
      'href',
      '/invoices',
    )
  })

  it('says when the Invoice does not exist', async () => {
    renderApp(`/invoices/${makeInvoice(9).invoiceId}`, { signedIn: true })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Invoice not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to invoices' })).toBeInTheDocument()
  })

  it('treats an id that is not a UUID as not found', async () => {
    server.use(
      http.get('/api/invoices/:invoiceId', () =>
        HttpResponse.json(
          { statusCode: 400, message: 'id must be a valid UUID', error: 'Bad Request' },
          { status: 400 },
        ),
      ),
    )
    renderApp('/invoices/not-a-uuid', { signedIn: true })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Invoice not found' }),
    ).toBeInTheDocument()
  })

  it('offers Retry when loading fails', async () => {
    let calls = 0
    server.use(
      http.get(`/api/invoices/${appendixAInvoice.invoiceId}`, () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json(
              { statusCode: 500, message: 'Internal server error', error: 'Internal Server Error' },
              { status: 500 },
            )
          : HttpResponse.json(appendixAInvoice)
      }),
    )
    const user = userEvent.setup()
    renderApp(detailPath, { signedIn: true })

    expect(await screen.findByText('Could not load this invoice.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'IV1780488206995' }),
    ).toBeInTheDocument()
  })
})
