import { Decimal } from 'decimal.js';
import { InvoiceItem } from './entities/invoice-item.entity.js';
import { Invoice } from './entities/invoice.entity.js';
import { toInvoiceDto } from './invoice.mapper.js';

/** Appendix A of the assessment, as the API must return it on 2026-09-15. */
const APPENDIX_A_JSON = {
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
  createdBy: 'ad1e0902-1928-4345-b513-60c86c94fc91',
};

/** The Appendix A Invoice as TypeORM loads it: NUMERIC columns are Decimals. */
function appendixAInvoice(overrides: Partial<Invoice> = {}): Invoice {
  const item = Object.assign(new InvoiceItem(), {
    id: 'b1c2d3e4-0000-0000-0000-000000000001',
    invoiceId: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
    name: 'Honda RC150',
    quantity: 2,
    rate: new Decimal('1000.00'),
  } satisfies Partial<InvoiceItem>);
  return Object.assign(new Invoice(), {
    invoiceId: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
    invoiceNumber: 'IV1780488206995',
    invoiceReference: '#5721662',
    invoiceDate: '2026-06-03',
    dueDate: '2026-07-03',
    currency: 'AUD',
    currencySymbol: 'AU$',
    description: 'Invoice is issued to Kanglee',
    status: 'Pending',
    customerFullname: 'Paul',
    customerEmail: 'paul@101digital.io',
    customerMobileNumber: '947717364111',
    customerAddress: 'Singapore',
    taxRate: new Decimal('10.00'),
    invoiceSubTotal: new Decimal('2000.00'),
    totalTax: new Decimal('200.00'),
    totalDiscount: new Decimal('20.00'),
    totalAmount: new Decimal('2180.00'),
    totalPaid: new Decimal('1451.34'),
    balanceAmount: new Decimal('728.66'),
    createdAt: new Date('2026-06-03T12:03:26.995Z'),
    createdBy: 'ad1e0902-1928-4345-b513-60c86c94fc91',
    items: [item],
    ...overrides,
  } satisfies Partial<Invoice>);
}

describe('toInvoiceDto', () => {
  it('maps the Appendix A Invoice to exactly the documented JSON', () => {
    expect(toInvoiceDto(appendixAInvoice(), '2026-09-15')).toEqual(
      APPENDIX_A_JSON,
    );
  });

  it('shows the Stored Status until the Due Date has passed', () => {
    expect(toInvoiceDto(appendixAInvoice(), '2026-07-03').status).toBe(
      'Pending',
    );
  });

  it('returns null for empty optional fields', () => {
    const dto = toInvoiceDto(
      appendixAInvoice({
        invoiceReference: null,
        description: null,
        customerMobileNumber: null,
        customerAddress: null,
      }),
      '2026-06-03',
    );
    expect(dto.invoiceReference).toBeNull();
    expect(dto.description).toBeNull();
    expect(dto.customer).toEqual({
      fullname: 'Paul',
      email: 'paul@101digital.io',
      mobileNumber: null,
      address: null,
    });
  });

  it('computes the item amount as quantity × Rate, to 2 decimal places', () => {
    const item = Object.assign(new InvoiceItem(), {
      id: 'b1c2d3e4-0000-0000-0000-000000000002',
      name: 'Consulting',
      quantity: 3,
      rate: new Decimal('19.99'),
    } satisfies Partial<InvoiceItem>);
    const dto = toInvoiceDto(appendixAInvoice({ items: [item] }), '2026-06-03');
    expect(dto.items).toEqual([
      {
        id: 'b1c2d3e4-0000-0000-0000-000000000002',
        name: 'Consulting',
        quantity: 3,
        rate: 19.99,
        amount: 59.97,
      },
    ]);
  });
});
