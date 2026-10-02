import {
  APPENDIX_A_INVOICE,
  DEFAULT_USER_ID,
} from '../src/database/seed/appendix-a.js';
import { seedDatabase } from '../src/database/seed/seeder.js';
import { PasswordHasher } from '../src/users/password-hasher.js';
import {
  startDatabase,
  stopDatabase,
  type TestDatabase,
} from './utils/database.js';
import { randomPassword } from './utils/test-app.js';

const TODAY = '2026-09-15';
const NOW = new Date('2026-09-15T10:00:00.000Z');
const USER = {
  email: 'Admin@Example.com',
  password: randomPassword(),
  fullname: 'Admin User',
};
const NEW_PASSWORD = randomPassword();

describe('Seeder (e2e)', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startDatabase();
  });

  afterAll(async () => {
    await stopDatabase(db);
  });

  async function counts() {
    const [row] = await db.dataSource.query<
      { users: number; invoices: number; items: number }[]
    >(
      `SELECT (SELECT count(*)::int FROM users) AS users,
              (SELECT count(*)::int FROM invoices) AS invoices,
              (SELECT count(*)::int FROM invoice_items) AS items`,
    );
    return row;
  }

  async function passwordHash(): Promise<string> {
    const [user] = await db.dataSource.query<{ password_hash: string }[]>(
      `SELECT password_hash FROM users WHERE id = $1`,
      [DEFAULT_USER_ID],
    );
    return user.password_hash;
  }

  it('applies the migrations and inserts the User, Appendix A and 40 generated Invoices', async () => {
    const result = await seedDatabase(db.dataSource, {
      user: USER,
      today: TODAY,
      now: NOW,
    });
    expect(result).toEqual({ invoicesInserted: 41 });
    expect(await counts()).toEqual({ users: 1, invoices: 41, items: 41 });
  });

  it('inserts nothing when run again', async () => {
    const before = await passwordHash();
    const result = await seedDatabase(db.dataSource, {
      user: USER,
      today: TODAY,
      now: NOW,
    });
    expect(result).toEqual({ invoicesInserted: 0 });
    expect(await counts()).toEqual({ users: 1, invoices: 41, items: 41 });
    // The default User is upserted on every run, and bcrypt salts each hash anew.
    expect(await passwordHash()).not.toBe(before);
  });

  it('stores the Appendix A Invoice verbatim', async () => {
    const [invoice] = await db.dataSource.query(
      `SELECT invoice_number, invoice_reference, invoice_date, due_date, currency,
              currency_symbol, description, status, customer_fullname, customer_email,
              customer_mobile_number, customer_address, tax_rate::text,
              invoice_sub_total::text, total_tax::text, total_discount::text,
              total_amount::text, total_paid::text, balance_amount::text,
              created_at, created_by
       FROM invoices WHERE invoice_id = $1`,
      [APPENDIX_A_INVOICE.invoiceId],
    );
    expect(invoice).toEqual({
      invoice_number: 'IV1780488206995',
      invoice_reference: '#5721662',
      invoice_date: '2026-06-03',
      due_date: '2026-07-03',
      currency: 'AUD',
      currency_symbol: 'AU$',
      description: 'Invoice is issued to Kanglee',
      status: 'Pending',
      customer_fullname: 'Paul',
      customer_email: 'paul@101digital.io',
      customer_mobile_number: '947717364111',
      customer_address: 'Singapore',
      tax_rate: '10.00',
      invoice_sub_total: '2000.00',
      total_tax: '200.00',
      total_discount: '20.00',
      total_amount: '2180.00',
      total_paid: '1451.34',
      balance_amount: '728.66',
      created_at: new Date('2026-06-03T12:03:26.995Z'),
      created_by: DEFAULT_USER_ID,
    });

    const items = await db.dataSource.query(
      `SELECT id, name, quantity, rate::text FROM invoice_items WHERE invoice_id = $1`,
      [APPENDIX_A_INVOICE.invoiceId],
    );
    expect(items).toEqual([
      {
        id: 'b1c2d3e4-0000-0000-0000-000000000001',
        name: 'Honda RC150',
        quantity: 2,
        rate: '1000.00',
      },
    ]);
  });

  it('stores the default User with a lower-case email and a bcrypt hash', async () => {
    const [user] = await db.dataSource.query(
      `SELECT id, email, fullname, password_hash FROM users`,
    );
    expect(user).toMatchObject({
      id: DEFAULT_USER_ID,
      email: 'admin@example.com',
      fullname: 'Admin User',
    });
    expect(
      await new PasswordHasher().verify(USER.password, user.password_hash),
    ).toBe(true);
  });

  it('reset restores every demo Invoice and updates the default User', async () => {
    await db.dataSource.query(
      `DELETE FROM invoices WHERE invoice_number IN ('INV-0001', 'INV-0002')`,
    );
    expect(await counts()).toEqual({ users: 1, invoices: 39, items: 39 });

    const result = await seedDatabase(db.dataSource, {
      user: { ...USER, password: NEW_PASSWORD },
      today: TODAY,
      now: NOW,
      reset: true,
    });

    expect(result).toEqual({ invoicesInserted: 41 });
    expect(await counts()).toEqual({ users: 1, invoices: 41, items: 41 });
    const [user] = await db.dataSource.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [DEFAULT_USER_ID],
    );
    expect(
      await new PasswordHasher().verify(NEW_PASSWORD, user.password_hash),
    ).toBe(true);
  });
});
