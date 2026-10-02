import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { Invoice } from '../../../api/types'
import { makeInvoice } from '../../../test/fixtures'
import { server } from '../../../test/msw/server'
import { renderApp } from '../../../test/renderApp'

type TestUser = ReturnType<typeof userEvent.setup>

const textbox = (name: string) => screen.getByRole('textbox', { name })

/** Answers every `POST /api/invoices` with `status` and `body`. */
function answerCreate(status: number, body: Record<string, unknown>) {
  server.use(http.post('/api/invoices', () => HttpResponse.json(body, { status })))
}

/** Opens the form and fills in the required fields; the others keep their defaults. */
async function openFilledForm(user: TestUser) {
  renderApp('/invoices/new', { signedIn: true })
  await user.type(await screen.findByRole('textbox', { name: 'Customer name' }), 'Kanglee Trading')
  await user.type(textbox('Email'), 'billing@kanglee.example')
  await user.type(textbox('Invoice number'), 'INV-2026-0042')
  await user.type(textbox('Item name'), 'Consulting')
  await user.type(textbox('Rate'), '19.99')
}

describe('CreateInvoicePage', () => {
  beforeEach(() => {
    // Fake only the clock, so "today" is fixed and every timer still runs.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-02T09:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('starts dated today, due in 30 days, in AUD at a 10 % Tax Rate', async () => {
    renderApp('/invoices/new', { signedIn: true })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'New invoice' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/^Invoice date/)).toHaveValue('2026-10-02')
    expect(screen.getByLabelText(/^Due date/)).toHaveValue('2026-11-01')
    expect(screen.getByRole('combobox', { name: 'Currency' })).toHaveTextContent('AUD (AU$)')
    expect(textbox('Quantity')).toHaveValue('1')
    expect(textbox('Tax rate (%)')).toHaveValue('10')
    expect(textbox('Discount')).toHaveValue('0')
  })

  it('lists what is missing and focuses the first invalid field', async () => {
    const user = userEvent.setup()
    renderApp('/invoices/new', { signedIn: true })

    await user.click(await screen.findByRole('button', { name: 'Create invoice' }))

    expect(await screen.findByText('Customer name is required')).toBeInTheDocument()
    expect(screen.getByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Invoice number is required')).toBeInTheDocument()
    expect(screen.getByText('Item name is required')).toBeInTheDocument()
    expect(screen.getByText('Rate is required')).toBeInTheDocument()
    expect(textbox('Customer name')).toHaveAttribute('aria-invalid', 'true')
    expect(textbox('Customer name')).toHaveFocus()
  })

  it('checks a format as soon as the field is left', async () => {
    const user = userEvent.setup()
    renderApp('/invoices/new', { signedIn: true })

    await user.type(await screen.findByRole('textbox', { name: 'Email' }), 'paul')
    await user.type(textbox('Rate'), '1.005')
    await user.tab()

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByText('Rate must have at most 2 decimal places')).toBeInTheDocument()
  })

  it('rejects a Due Date before the Invoice Date', async () => {
    renderApp('/invoices/new', { signedIn: true })
    const dueDate = await screen.findByLabelText(/^Due date/)

    // user-event cannot type into a native date input; set its value directly.
    fireEvent.change(dueDate, { target: { value: '2026-10-01' } })
    fireEvent.blur(dueDate)

    expect(
      await screen.findByText('Due date must be on or after the invoice date'),
    ).toBeInTheDocument()
  })

  it('creates the Invoice, says so, and shows it at the top of the list', async () => {
    let created: Invoice | undefined
    const received: unknown[] = []
    server.use(
      http.post('/api/invoices', async ({ request }) => {
        received.push(await request.json())
        created = makeInvoice(42, { invoiceNumber: 'INV-2026-0042', status: 'Draft' })
        return HttpResponse.json(created, { status: 201 })
      }),
      http.get('/api/invoices', () =>
        HttpResponse.json({
          data: created ? [created] : [],
          paging: { page: 1, pageSize: 10, total: created ? 1 : 0 },
        }),
      ),
    )
    const user = userEvent.setup()
    const { router } = renderApp('/invoices', { signedIn: true })
    await user.click(await screen.findByRole('link', { name: 'Create invoice' }))

    await user.type(
      await screen.findByRole('textbox', { name: 'Customer name' }),
      'Kanglee Trading',
    )
    await user.type(textbox('Email'), 'billing@kanglee.example')
    await user.type(textbox('Mobile number'), '+65 9477 1736')
    await user.type(textbox('Address'), '1 Raffles Place, Singapore')
    await user.type(textbox('Invoice number'), 'INV-2026-0042')
    await user.type(textbox('Reference'), 'PO-7781')
    await user.click(screen.getByRole('combobox', { name: 'Currency' }))
    await user.click(screen.getByRole('option', { name: 'USD (US$)' }))
    await user.type(textbox('Description'), 'Consulting for October')
    await user.type(textbox('Item name'), 'Consulting')
    await user.clear(textbox('Quantity'))
    await user.type(textbox('Quantity'), '3')
    await user.type(textbox('Rate'), '19.99')
    await user.clear(textbox('Discount'))
    await user.type(textbox('Discount'), '1.97')
    await user.click(screen.getByRole('button', { name: 'Create invoice' }))

    expect(await screen.findByText('Invoice INV-2026-0042 created')).toBeInTheDocument()
    // The list was cached before; it shows the new Invoice only because the cache was invalidated.
    expect(await screen.findByRole('link', { name: 'INV-2026-0042' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/invoices')
    expect(received).toEqual([
      {
        customer: {
          fullname: 'Kanglee Trading',
          email: 'billing@kanglee.example',
          mobileNumber: '+65 9477 1736',
          address: '1 Raffles Place, Singapore',
        },
        invoiceNumber: 'INV-2026-0042',
        invoiceReference: 'PO-7781',
        invoiceDate: '2026-10-02',
        dueDate: '2026-11-01',
        currency: 'USD',
        description: 'Consulting for October',
        items: [{ name: 'Consulting', quantity: 3, rate: 19.99 }],
        taxRate: 10,
        discount: 1.97,
      },
    ])
  })

  it('shows a duplicate Invoice Number on its field', async () => {
    answerCreate(409, {
      statusCode: 409,
      message: 'Invoice number INV-2026-0042 already exists',
      error: 'Conflict',
    })
    const user = userEvent.setup()
    await openFilledForm(user)

    await user.click(screen.getByRole('button', { name: 'Create invoice' }))

    expect(
      await screen.findByText('Invoice number INV-2026-0042 already exists'),
    ).toBeInTheDocument()
    expect(textbox('Invoice number')).toHaveAttribute('aria-invalid', 'true')
    expect(textbox('Invoice number')).toHaveFocus()
  })

  it('puts the server validation messages on their fields', async () => {
    answerCreate(400, {
      statusCode: 400,
      message: [
        'discount must not exceed the sub-total plus tax',
        'customer.email must be an email',
        'items must contain exactly 1 item',
      ],
      error: 'Bad Request',
    })
    const user = userEvent.setup()
    await openFilledForm(user)

    await user.click(screen.getByRole('button', { name: 'Create invoice' }))

    expect(
      await screen.findByText('Discount must not exceed the sub-total plus tax'),
    ).toBeInTheDocument()
    expect(screen.getByText('Email must be an email')).toBeInTheDocument()
    expect(screen.getByText('items must contain exactly 1 item')).toBeInTheDocument()
    expect(textbox('Email')).toHaveFocus()
  })

  it('reports an unexpected failure above the form', async () => {
    answerCreate(500, {
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    })
    const user = userEvent.setup()
    await openFilledForm(user)

    await user.click(screen.getByRole('button', { name: 'Create invoice' }))

    expect(
      await screen.findByText('Could not create the invoice. Please try again.'),
    ).toBeInTheDocument()
  })
})
