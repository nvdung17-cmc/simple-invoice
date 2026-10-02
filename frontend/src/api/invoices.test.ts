import { http, HttpResponse } from 'msw'
import { server } from '../test/msw/server'
import { createInvoice, getInvoice, invoiceKeys, listInvoices } from './invoices'
import type { CreateInvoiceRequest } from './types'

describe('invoice API', () => {
  it('sends the list query without unset filters', async () => {
    let url: URL | undefined
    server.use(
      http.get('/api/invoices', ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({ data: [], paging: { page: 2, pageSize: 20, total: 0 } })
      }),
    )

    const result = await listInvoices({
      page: 2,
      pageSize: 20,
      ordering: 'ASC',
      sortBy: 'dueDate',
      status: 'Overdue',
      keyword: undefined,
    })

    expect(result.paging).toEqual({ page: 2, pageSize: 20, total: 0 })
    expect(Object.fromEntries(url!.searchParams)).toEqual({
      page: '2',
      pageSize: '20',
      ordering: 'ASC',
      sortBy: 'dueDate',
      status: 'Overdue',
    })
  })

  it('escapes the Invoice id in the detail path', async () => {
    let path: string | undefined
    server.use(
      http.get('/api/invoices/*', ({ request }) => {
        path = new URL(request.url).pathname
        return HttpResponse.json({ invoiceId: 'a/b' })
      }),
    )

    await getInvoice('a/b')

    expect(path).toBe('/api/invoices/a%2Fb')
  })

  it('posts a new Invoice as JSON', async () => {
    let received: unknown
    server.use(
      http.post('/api/invoices', async ({ request }) => {
        received = await request.json()
        return HttpResponse.json({ invoiceNumber: 'INV-1' }, { status: 201 })
      }),
    )
    const body: CreateInvoiceRequest = {
      customer: { fullname: 'Paul', email: 'paul@101digital.io' },
      invoiceNumber: 'INV-1',
      invoiceDate: '2026-10-02',
      dueDate: '2026-11-01',
      currency: 'AUD',
      items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
      taxRate: 10,
      discount: 0,
    }

    await expect(createInvoice(body)).resolves.toEqual({ invoiceNumber: 'INV-1' })
    expect(received).toEqual(body)
  })

  it('nests every query key under the same root', () => {
    const query = { page: 1, pageSize: 10, ordering: 'DESC' as const }
    expect(invoiceKeys.list(query)).toEqual(['invoices', 'list', query])
    expect(invoiceKeys.detail('id-1')).toEqual(['invoices', 'detail', 'id-1'])
  })
})
