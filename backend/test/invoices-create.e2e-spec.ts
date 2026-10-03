import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DEFAULT_USER_ID } from '../src/database/seed/appendix-a.js';
import {
  loginAs,
  startTestApp,
  stopTestApp,
  type TestContext,
} from './utils/test-app.js';

const BODY = {
  customer: {
    fullname: '  Kanglee Trading  ',
    email: 'billing@kanglee.example',
    mobileNumber: '+65 9477 1736',
    address: '1 Raffles Place, Singapore',
  },
  invoiceNumber: 'INV-2026-0042',
  invoiceReference: 'PO-7781',
  invoiceDate: '2026-09-15',
  dueDate: '2026-10-15',
  currency: 'usd',
  description: 'Consulting for September',
  items: [{ name: 'Consulting', quantity: 3, rate: 19.99 }],
  taxRate: 10,
  discount: 1.97,
};

describe('Invoices: create (e2e)', () => {
  let context: TestContext;
  let server: App;
  let token: string;

  beforeAll(async () => {
    context = await startTestApp();
    server = context.app.getHttpServer();
    token = await loginAs(server);
  });

  afterAll(async () => {
    await stopTestApp(context);
  });

  function create(body: object) {
    return request(server)
      .post('/invoices')
      .auth(token, { type: 'bearer' })
      .send(body);
  }

  function get(path: string) {
    return request(server).get(path).auth(token, { type: 'bearer' });
  }

  it('creates a Draft Invoice with server-computed totals', async () => {
    const res = await create(BODY).expect(201);
    expect(res.body).toEqual({
      invoiceId: expect.any(String),
      invoiceNumber: 'INV-2026-0042',
      invoiceReference: 'PO-7781',
      invoiceDate: '2026-09-15',
      dueDate: '2026-10-15',
      currency: 'USD',
      currencySymbol: 'US$',
      description: 'Consulting for September',
      status: 'Draft',
      customer: {
        fullname: 'Kanglee Trading',
        email: 'billing@kanglee.example',
        mobileNumber: '+65 9477 1736',
        address: '1 Raffles Place, Singapore',
      },
      items: [
        {
          id: expect.any(String),
          name: 'Consulting',
          quantity: 3,
          rate: 19.99,
          amount: 59.97,
        },
      ],
      taxRate: 10,
      invoiceSubTotal: 59.97,
      totalTax: 6,
      totalDiscount: 1.97,
      totalAmount: 64,
      totalPaid: 0,
      balanceAmount: 64,
      createdAt: expect.any(String),
      createdBy: DEFAULT_USER_ID,
    });
    expect(res.headers.location).toBe(`/invoices/${res.body.invoiceId}`);

    // The detail view and the list return the same representation.
    const detail = await get(res.headers.location).expect(200);
    expect(detail.body).toEqual(res.body);
    const search = await get('/invoices?keyword=INV-2026-0042').expect(200);
    expect(search.body.data).toEqual([res.body]);
    // It is the newest Invoice, so it heads the default list.
    const newest = await get('/invoices').expect(200);
    expect(newest.body.data[0].invoiceId).toBe(res.body.invoiceId);
    expect(newest.body.paging.total).toBe(42);
  });

  it('applies the default Tax Rate and stores blank optional fields as null', async () => {
    const res = await create({
      customer: {
        fullname: 'Sarah Lee',
        email: 'sarah@example.com',
        mobileNumber: '',
        address: '   ',
      },
      invoiceNumber: 'INV-DEFAULTS',
      invoiceReference: '  ',
      invoiceDate: '2026-09-15',
      dueDate: '2026-09-15',
      currency: 'aud',
      description: '',
      items: [{ name: 'Audit', quantity: 1, rate: 100 }],
    }).expect(201);
    expect(res.body).toMatchObject({
      invoiceReference: null,
      description: null,
      currency: 'AUD',
      currencySymbol: 'AU$',
      customer: { mobileNumber: null, address: null },
      taxRate: 10,
      invoiceSubTotal: 100,
      totalTax: 10,
      totalDiscount: 0,
      totalAmount: 110,
      balanceAmount: 110,
    });
  });

  it('rejects a duplicate Invoice Number, ignoring case', async () => {
    await create({ ...BODY, invoiceNumber: 'DUP-001' }).expect(201);

    const exact = await create({ ...BODY, invoiceNumber: 'DUP-001' }).expect(
      409,
    );
    expect(exact.body).toEqual({
      statusCode: 409,
      message: 'Invoice number DUP-001 already exists',
      error: 'Conflict',
    });
    const otherCase = await create({
      ...BODY,
      invoiceNumber: 'dup-001',
    }).expect(409);
    expect(otherCase.body.message).toBe(
      'Invoice number dup-001 already exists',
    );
  });

  it('rejects a Due Date before the Invoice Date', async () => {
    const res = await create({
      ...BODY,
      invoiceNumber: 'INV-DATES',
      dueDate: '2026-09-14',
    }).expect(400);
    expect(res.body).toEqual({
      statusCode: 400,
      message: ['dueDate must be on or after invoiceDate'],
      error: 'Bad Request',
    });
  });

  it('rejects a discount above the sub-total plus tax', async () => {
    const res = await create({
      ...BODY,
      invoiceNumber: 'INV-DISCOUNT',
      discount: 100,
    }).expect(400);
    expect(res.body.message).toEqual([
      'discount must not exceed the sub-total plus tax',
    ]);
  });

  it('names nested fields in the messages', async () => {
    const res = await create({
      ...BODY,
      invoiceNumber: 'INV-NESTED',
      customer: { ...BODY.customer, email: 'paul' },
      items: [{ name: 'Consulting', quantity: 3, rate: 1.005 }],
    }).expect(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([
        'customer.email must be an email',
        'items.0.rate must have at most 2 decimal places',
      ]),
    );
  });

  it('rejects fields the caller may not set, such as the Status or totals', async () => {
    const res = await create({
      ...BODY,
      invoiceNumber: 'INV-EXTRA',
      status: 'Paid',
      totalAmount: 1,
    }).expect(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([
        'property status should not exist',
        'property totalAmount should not exist',
      ]),
    );
  });

  it('rejects a NUL character in a text field with 400, and inserts nothing', async () => {
    const res = await create({
      ...BODY,
      invoiceNumber: 'INV-NUL',
      description: 'Consulting\u0000September',
    }).expect(400);
    expect(res.body).toEqual({
      statusCode: 400,
      message: ['description must not contain a NUL character'],
      error: 'Bad Request',
    });
    // Rejected before it reaches PostgreSQL: no Invoice has this number.
    const search = await get('/invoices?keyword=INV-NUL').expect(200);
    expect(search.body.data).toEqual([]);
    expect(search.body.paging.total).toBe(0);
  });

  it('rejects a text over its limit in code points with 400, and inserts nothing', async () => {
    // U+2764 U+FE0F counts as one character to validator.js (so @MaxLength) but
    // as two to PostgreSQL: 1,001 code points once answered 500 (22001).
    const res = await create({
      ...BODY,
      invoiceNumber: 'INV-LONG',
      description: 'x'.repeat(999) + '\u{2764}\u{FE0F}',
    }).expect(400);
    expect(res.body).toEqual({
      statusCode: 400,
      message: ['description must be shorter than or equal to 1000 characters'],
      error: 'Bad Request',
    });
    const search = await get('/invoices?keyword=INV-LONG').expect(200);
    expect(search.body.data).toEqual([]);
    expect(search.body.paging.total).toBe(0);
  });

  it('requires authentication', async () => {
    await request(server).post('/invoices').send(BODY).expect(401);
  });
});
