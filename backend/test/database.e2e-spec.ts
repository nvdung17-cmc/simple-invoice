import { Decimal } from 'decimal.js';
import { QueryFailedError } from 'typeorm';
import { Invoice } from '../src/invoices/entities/invoice.entity.js';
import { InvoiceItem } from '../src/invoices/entities/invoice-item.entity.js';
import {
  startDatabase,
  stopDatabase,
  type TestDatabase,
} from './utils/database.js';

interface PgError {
  code?: string;
  constraint?: string;
}

describe('Database schema (e2e)', () => {
  let db: TestDatabase;
  let userId: string;
  let invoiceCounter = 0;

  beforeAll(async () => {
    db = await startDatabase();
    const applied = await db.dataSource.runMigrations({ transaction: 'each' });
    expect(applied.map((m) => m.name)).toEqual(['InitialSchema1790812800000']);
    const [user] = await db.dataSource.query<{ id: string }[]>(
      `INSERT INTO users (email, password_hash, fullname)
       VALUES ('owner@example.com', 'not-a-real-hash', 'Owner') RETURNING id`,
    );
    userId = user.id;
  });

  afterAll(async () => {
    await stopDatabase(db);
  });

  /** Inserts a valid Invoice row; `overrides` replaces column values. */
  async function insertInvoice(
    overrides: Record<string, unknown> = {},
  ): Promise<string> {
    invoiceCounter += 1;
    const row: Record<string, unknown> = {
      invoice_number: `T-${invoiceCounter}`,
      invoice_date: '2026-09-01',
      due_date: '2026-09-30',
      currency: 'AUD',
      currency_symbol: 'AU$',
      customer_fullname: 'Test Customer',
      customer_email: 'customer@example.com',
      tax_rate: '10',
      invoice_sub_total: '100',
      total_tax: '10',
      total_discount: '0',
      total_amount: '110',
      total_paid: '0',
      balance_amount: '110',
      created_by: userId,
      ...overrides,
    };
    const columns = Object.keys(row);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const [inserted] = await db.dataSource.query<{ invoice_id: string }[]>(
      `INSERT INTO invoices (${columns.join(', ')})
       VALUES (${placeholders.join(', ')}) RETURNING invoice_id`,
      Object.values(row),
    );
    return inserted.invoice_id;
  }

  /** Awaits a query that must fail and returns the PostgreSQL error. */
  async function pgError(query: Promise<unknown>): Promise<PgError> {
    const error = await query.then(
      () => undefined,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(QueryFailedError);
    return (error as QueryFailedError).driverError as PgError;
  }

  it('creates the tables, the Stored Status enum and the indexes', async () => {
    const tables = await db.dataSource.query<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' ORDER BY table_name`,
    );
    expect(tables.map((t) => t.table_name)).toEqual([
      'invoice_items',
      'invoices',
      'migrations',
      'users',
    ]);

    const [statusType] = await db.dataSource.query<{ labels: string[] }[]>(
      `SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
       FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'invoice_status'`,
    );
    expect(statusType.labels).toEqual(['Draft', 'Pending', 'Paid']);

    const indexes = await db.dataSource.query<{ indexname: string }[]>(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`,
    );
    expect(indexes.map((i) => i.indexname)).toEqual(
      expect.arrayContaining([
        'users_email_lower_uq',
        'invoices_invoice_number_lower_uq',
        'invoices_invoice_number_trgm',
        'invoices_customer_fullname_trgm',
        'invoices_invoice_date_idx',
        'invoices_due_date_idx',
        'invoices_total_amount_idx',
        'invoices_created_at_idx',
        'invoices_status_due_date_idx',
        'invoices_created_by_idx',
        'invoice_items_invoice_id_idx',
      ]),
    );

    // The migration creates pg_trgm itself and ids use gen_random_uuid(), so no
    // other extension may be installed (TypeORM would add uuid-ossp on connect).
    const extensions = await db.dataSource.query<{ extname: string }[]>(
      'SELECT extname FROM pg_extension ORDER BY extname',
    );
    expect(extensions.map((e) => e.extname)).toEqual(['pg_trgm', 'plpgsql']);
  });

  it.each([
    [
      'invoices_due_date_check',
      { invoice_date: '2026-09-02', due_date: '2026-09-01' },
    ],
    ['invoices_currency_check', { currency: 'aud' }],
    ['invoices_tax_rate_check', { tax_rate: '100.5' }],
    [
      'invoices_amounts_non_negative_check',
      { total_discount: '-1', total_amount: '111', balance_amount: '111' },
    ],
    [
      'invoices_total_amount_check',
      { total_amount: '120', balance_amount: '120' },
    ],
    ['invoices_balance_amount_check', { balance_amount: '100' }],
    ['invoices_paid_balance_check', { status: 'Paid' }],
  ])('enforces %s', async (constraint, overrides) => {
    expect(await pgError(insertInvoice(overrides))).toMatchObject({
      code: '23514',
      constraint,
    });
  });

  it('rejects a Total Paid above the Total Amount', async () => {
    const error = await pgError(
      insertInvoice({ total_paid: '120', balance_amount: '-10' }),
    );
    expect(error.code).toBe('23514');
  });

  it('cannot store Overdue as a Stored Status', async () => {
    expect(await pgError(insertInvoice({ status: 'Overdue' }))).toMatchObject({
      code: '22P02',
    });
  });

  it('keeps Invoice Numbers unique regardless of case', async () => {
    await insertInvoice({ invoice_number: 'CASE-001' });
    expect(
      await pgError(insertInvoice({ invoice_number: 'case-001' })),
    ).toMatchObject({
      code: '23505',
      constraint: 'invoices_invoice_number_lower_uq',
    });
  });

  it('keeps User emails unique regardless of case', async () => {
    const duplicate = db.dataSource.query(
      `INSERT INTO users (email, password_hash, fullname)
       VALUES ('Owner@Example.com', 'x', 'Copy')`,
    );
    expect(await pgError(duplicate)).toMatchObject({
      code: '23505',
      constraint: 'users_email_lower_uq',
    });
  });

  it('enforces the Invoice Item quantity and Rate checks', async () => {
    const invoiceId = await insertInvoice();
    const insertItem = (quantity: number, rate: string) =>
      db.dataSource.query(
        `INSERT INTO invoice_items (invoice_id, name, quantity, rate)
         VALUES ($1, 'Item', $2, $3)`,
        [invoiceId, quantity, rate],
      );
    expect(await pgError(insertItem(0, '1'))).toMatchObject({
      code: '23514',
      constraint: 'invoice_items_quantity_check',
    });
    expect(await pgError(insertItem(1, '0'))).toMatchObject({
      code: '23514',
      constraint: 'invoice_items_rate_check',
    });
  });

  it('deletes Invoice Items together with their Invoice', async () => {
    const invoiceId = await insertInvoice();
    await db.dataSource.query(
      `INSERT INTO invoice_items (invoice_id, name, quantity, rate)
       VALUES ($1, 'Item', 1, 100)`,
      [invoiceId],
    );
    await db.dataSource.query(`DELETE FROM invoices WHERE invoice_id = $1`, [
      invoiceId,
    ]);
    const [{ count }] = await db.dataSource.query<{ count: number }[]>(
      `SELECT count(*)::int AS count FROM invoice_items WHERE invoice_id = $1`,
      [invoiceId],
    );
    expect(count).toBe(0);
  });

  it('round-trips entities with Decimal amounts and string dates', async () => {
    const invoices = db.dataSource.getRepository(Invoice);
    const items = db.dataSource.getRepository(InvoiceItem);
    const saved = await invoices.save(
      invoices.create({
        invoiceNumber: 'ROUND-TRIP-1',
        invoiceReference: null,
        invoiceDate: '2026-06-03',
        dueDate: '2026-07-03',
        currency: 'AUD',
        currencySymbol: 'AU$',
        description: null,
        status: 'Pending',
        customerFullname: 'Paul',
        customerEmail: 'paul@101digital.io',
        customerMobileNumber: null,
        customerAddress: null,
        taxRate: new Decimal(10),
        invoiceSubTotal: new Decimal(2000),
        totalTax: new Decimal(200),
        totalDiscount: new Decimal(20),
        totalAmount: new Decimal(2180),
        totalPaid: new Decimal('1451.34'),
        balanceAmount: new Decimal('728.66'),
        createdBy: userId,
        items: [
          items.create({
            name: 'Honda RC150',
            quantity: 2,
            rate: new Decimal(1000),
          }),
        ],
      }),
    );

    const loaded = await invoices.findOneOrFail({
      where: { invoiceId: saved.invoiceId },
      relations: { items: true },
    });
    expect(loaded.invoiceDate).toBe('2026-06-03');
    expect(loaded.dueDate).toBe('2026-07-03');
    expect(loaded.totalPaid).toBeInstanceOf(Decimal);
    expect(loaded.totalPaid.toFixed(2)).toBe('1451.34');
    expect(loaded.taxRate.toFixed(2)).toBe('10.00');
    expect(loaded.status).toBe('Pending');
    expect(loaded.createdAt).toBeInstanceOf(Date);
    expect(loaded.items).toHaveLength(1);
    expect(loaded.items[0]).toMatchObject({
      invoiceId: saved.invoiceId,
      name: 'Honda RC150',
      quantity: 2,
    });
    expect(loaded.items[0].rate.toFixed(2)).toBe('1000.00');
  });

  it('returns DATE columns as strings in raw queries too', async () => {
    const [row] = await db.dataSource.query<{ invoice_date: unknown }[]>(
      `SELECT invoice_date FROM invoices LIMIT 1`,
    );
    expect(typeof row.invoice_date).toBe('string');
  });

  // Keep this test last: it drops the schema and recreates it.
  it('reverts the migration and applies it again', async () => {
    await db.dataSource.undoLastMigration({ transaction: 'each' });
    const [afterRevert] = await db.dataSource.query<
      { invoices: boolean; status: boolean }[]
    >(
      `SELECT to_regclass('public.invoices') IS NOT NULL AS invoices,
              to_regtype('invoice_status') IS NOT NULL AS status`,
    );
    expect(afterRevert).toEqual({ invoices: false, status: false });

    const applied = await db.dataSource.runMigrations({ transaction: 'each' });
    expect(applied).toHaveLength(1);
  });
});
