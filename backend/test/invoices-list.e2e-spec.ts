import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  loginAs,
  startTestApp,
  stopTestApp,
  type TestContext,
} from './utils/test-app.js';

const APPENDIX_A_ID = '099ca7da-a290-40fa-93b9-1c43ae7bb887';

/** Appendix A of the assessment, as the API returns it on TEST_TODAY (2026-09-15). */
const APPENDIX_A_JSON = {
  invoiceId: APPENDIX_A_ID,
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

interface InvoiceBody {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  customer: { fullname: string };
  items: unknown[];
}

interface ListBody {
  data: InvoiceBody[];
  paging: { page: number; pageSize: number; total: number };
}

type Query = Record<string, string | number>;

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const [x, y] = [String(a), String(b)];
  return x < y ? -1 : x > y ? 1 : 0;
}

describe('Invoices: list and detail (e2e)', () => {
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

  async function list(query: Query = {}): Promise<ListBody> {
    const res = await request(server)
      .get('/invoices')
      .query(query)
      .auth(token, { type: 'bearer' })
      .expect(200);
    return res.body as ListBody;
  }

  function listRejected(query: Query) {
    return request(server)
      .get('/invoices')
      .query(query)
      .auth(token, { type: 'bearer' })
      .expect(400);
  }

  describe('GET /invoices', () => {
    it('returns the first page, newest first, by default', async () => {
      const body = await list();
      expect(body.paging).toEqual({ page: 1, pageSize: 10, total: 41 });
      expect(body.data).toHaveLength(10);
      const createdAt = body.data.map((invoice) => invoice.createdAt);
      expect(createdAt).toEqual([...createdAt].sort().reverse());
      for (const invoice of body.data) expect(invoice.items).toHaveLength(1);
    });

    it('filters by each Status, and the four Statuses cover every Invoice once', async () => {
      let sum = 0;
      for (const status of ['Draft', 'Pending', 'Paid', 'Overdue']) {
        const body = await list({ status, pageSize: 100 });
        expect(body.data.every((invoice) => invoice.status === status)).toBe(
          true,
        );
        expect(body.data).toHaveLength(body.paging.total);
        sum += body.paging.total;
      }
      expect(sum).toBe(41);
    });

    it('matches the Status in any case', async () => {
      const lower = await list({ status: 'overdue', pageSize: 100 });
      const canonical = await list({ status: 'Overdue', pageSize: 100 });
      expect(lower.paging.total).toBe(canonical.paging.total);
      expect(lower.data.map((invoice) => invoice.invoiceId)).toContain(
        APPENDIX_A_ID,
      );
    });

    it('finds an Invoice by part of its number, ignoring case', async () => {
      const body = await list({ keyword: 'iv178' });
      expect(body.paging.total).toBe(1);
      expect(body.data[0]).toEqual(APPENDIX_A_JSON);
    });

    it('finds Invoices by part of the Customer name, ignoring case', async () => {
      const body = await list({ keyword: 'PAUL', pageSize: 100 });
      expect(body.data.map((invoice) => invoice.invoiceId)).toContain(
        APPENDIX_A_ID,
      );
      for (const invoice of body.data) {
        expect(
          `${invoice.invoiceNumber} ${invoice.customer.fullname}`.toLowerCase(),
        ).toContain('paul');
      }
    });

    it('matches the keyword against every Invoice Number', async () => {
      expect((await list({ keyword: 'inv-00' })).paging.total).toBe(40);
    });

    it('treats LIKE wildcards in the keyword as plain characters', async () => {
      expect((await list({ keyword: '%' })).paging.total).toBe(0);
      expect((await list({ keyword: '_' })).paging.total).toBe(0);
    });

    it('ignores a blank keyword and other blank parameters', async () => {
      const body = await list({
        keyword: '   ',
        status: '',
        sortBy: '',
        fromDate: '',
        toDate: '',
        page: '',
        pageSize: '',
        ordering: '',
      });
      // Blank counts as absent: the default paging, newest first.
      expect(body.paging).toEqual({ page: 1, pageSize: 10, total: 41 });
      expect(body.data).toHaveLength(10);
      const createdAt = body.data.map((invoice) => invoice.createdAt);
      expect(createdAt).toEqual([...createdAt].sort().reverse());
    });

    it.each([
      ['invoiceDate', 'asc'],
      ['invoiceDate', 'desc'],
      ['dueDate', 'asc'],
      ['dueDate', 'desc'],
      ['totalAmount', 'asc'],
      ['totalAmount', 'desc'],
    ] as const)('sorts by %s %s', async (sortBy, ordering) => {
      const body = await list({ sortBy, ordering, pageSize: 100 });
      const values = body.data.map((invoice) => invoice[sortBy]);
      const ascending = [...values].sort(compareValues);
      expect(values).toEqual(
        ordering === 'asc' ? ascending : ascending.reverse(),
      );
    });

    it('filters by Invoice Date, including both ends of the range', async () => {
      const day = await list({
        fromDate: '2026-06-03',
        toDate: '2026-06-03',
        pageSize: 100,
      });
      expect(day.data.map((invoice) => invoice.invoiceId)).toContain(
        APPENDIX_A_ID,
      );
      expect(
        day.data.every((invoice) => invoice.invoiceDate === '2026-06-03'),
      ).toBe(true);

      const june = await list({
        fromDate: '2026-06-01',
        toDate: '2026-06-30',
        pageSize: 100,
      });
      expect(
        june.data.every(
          (invoice) =>
            invoice.invoiceDate >= '2026-06-01' &&
            invoice.invoiceDate <= '2026-06-30',
        ),
      ).toBe(true);
    });

    it('rejects a date range that ends before it starts', async () => {
      const res = await listRejected({
        fromDate: '2026-07-01',
        toDate: '2026-06-01',
      });
      expect(res.body).toEqual({
        statusCode: 400,
        message: ['toDate must be on or after fromDate'],
        error: 'Bad Request',
      });
    });

    it('rejects a date that does not exist', async () => {
      const res = await listRejected({ fromDate: '2026-02-30' });
      expect(res.body.message).toEqual([
        'fromDate must be a valid date in YYYY-MM-DD format',
      ]);
    });

    it('paginates and always reports the true total', async () => {
      const first = await list({ page: 1, pageSize: 10 });
      const second = await list({ page: 2, pageSize: 10 });
      expect(second.paging).toEqual({ page: 2, pageSize: 10, total: 41 });
      const firstIds = new Set(first.data.map((invoice) => invoice.invoiceId));
      expect(
        second.data.some((invoice) => firstIds.has(invoice.invoiceId)),
      ).toBe(false);

      expect((await list({ page: 5, pageSize: 10 })).data).toHaveLength(1);
      const pastTheEnd = await list({ page: 6, pageSize: 10 });
      expect(pastTheEnd.data).toEqual([]);
      expect(pastTheEnd.paging).toEqual({ page: 6, pageSize: 10, total: 41 });
    });

    const invalidQueries: Array<[Query, string]> = [
      [{ pageSize: 101 }, 'pageSize must not be greater than 100'],
      [{ page: 0 }, 'page must not be less than 1'],
      [{ keyword: 'a\u0000b' }, 'keyword must not contain a NUL character'],
      [{ foo: 'bar' }, 'property foo should not exist'],
    ];

    it.each(invalidQueries)('rejects the query %o', async (query, message) => {
      const res = await listRejected(query);
      expect(res.body.message).toContain(message);
    });

    it('requires authentication', async () => {
      await request(server).get('/invoices').expect(401);
    });
  });

  describe('GET /invoices/:id', () => {
    it('returns the Appendix A Invoice exactly as documented', async () => {
      const res = await request(server)
        .get(`/invoices/${APPENDIX_A_ID}`)
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(res.body).toEqual(APPENDIX_A_JSON);
    });

    it('rejects an id that is not a UUID', async () => {
      const res = await request(server)
        .get('/invoices/not-a-uuid')
        .auth(token, { type: 'bearer' })
        .expect(400);
      expect(res.body).toEqual({
        statusCode: 400,
        message: 'id must be a valid UUID',
        error: 'Bad Request',
      });
    });

    it('answers 404 for an unknown id', async () => {
      const res = await request(server)
        .get(`/invoices/${randomUUID()}`)
        .auth(token, { type: 'bearer' })
        .expect(404);
      expect(res.body).toEqual({
        statusCode: 404,
        message: 'Invoice not found',
        error: 'Not Found',
      });
    });

    it('requires authentication', async () => {
      await request(server).get(`/invoices/${APPENDIX_A_ID}`).expect(401);
    });
  });
});
