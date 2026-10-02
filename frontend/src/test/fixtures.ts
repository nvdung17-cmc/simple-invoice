import type { Invoice, User } from '../api/types'

/** The seeded default User (backend seed, spec §5.8). */
export const userFixture: User = {
  id: 'ad1e0902-1928-4345-b513-60c86c94fc91',
  email: 'admin@example.com',
  fullname: 'Admin User',
  createdAt: '2026-06-01T09:00:00.000Z',
}

export const USER_PASSWORD = 'Password123!'

/** The Invoice from the assessment's Appendix A, exactly as the API serves it (spec §5.3). */
export const appendixAInvoice: Invoice = {
  invoiceId: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
  invoiceNumber: 'IV1780488206995',
  invoiceReference: '#5721662',
  invoiceDate: '2026-06-03',
  dueDate: '2026-07-03',
  currency: 'AUD',
  currencySymbol: 'AU$',
  description: 'Invoice is issued to Kanglee',
  status: 'Overdue',
  customer: {
    fullname: 'Paul',
    email: 'paul@101digital.io',
    mobileNumber: '947717364111',
    address: 'Singapore',
  },
  items: [
    {
      id: 'b1c2d3e4-0000-0000-0000-000000000001',
      name: 'Honda RC150',
      quantity: 2,
      rate: 1000,
      amount: 2000,
    },
  ],
  taxRate: 10,
  invoiceSubTotal: 2000,
  totalTax: 200,
  totalDiscount: 20,
  totalAmount: 2180,
  totalPaid: 1451.34,
  balanceAmount: 728.66,
  createdAt: '2026-06-03T12:03:26.995Z',
  createdBy: userFixture.id,
}

/** The `n`th of a series of distinct Invoices: `INV-0001`, `INV-0002`, … */
export function makeInvoice(n: number, overrides: Partial<Invoice> = {}): Invoice {
  const number = String(n).padStart(4, '0')
  return {
    ...appendixAInvoice,
    invoiceId: `00000000-0000-4000-8000-00000000${number}`,
    invoiceNumber: `INV-${number}`,
    customer: { ...appendixAInvoice.customer, fullname: `Customer ${number}` },
    ...overrides,
  }
}
