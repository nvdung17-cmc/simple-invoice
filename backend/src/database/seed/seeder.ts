import { Decimal } from 'decimal.js';
import type { DataSource } from 'typeorm';
import { CURRENCY_SYMBOLS } from '../../invoices/domain/currencies.js';
import { calculateInvoiceTotals } from '../../invoices/domain/invoice-totals.js';
import { Invoice } from '../../invoices/entities/invoice.entity.js';
import { InvoiceItem } from '../../invoices/entities/invoice-item.entity.js';
import { PasswordHasher } from '../../users/password-hasher.js';
import { User } from '../../users/user.entity.js';
import { APPENDIX_A_INVOICE, DEFAULT_USER_ID } from './appendix-a.js';
import { generateInvoices } from './generate-invoices.js';
import type { SeedInvoice } from './seed-invoice.js';

export interface SeedOptions {
  user: { email: string; password: string; fullname: string };
  /** "today" in APP_TIMEZONE; generated dates are relative to it. */
  today: string;
  /** Upper bound for generated `created_at` values. */
  now: Date;
  /** Truncate the Invoices (their items cascade) first. Users are kept. */
  reset?: boolean;
}

/**
 * Seeds the database (spec §5.8): pending migrations, the default User
 * (upserted by a fixed id), the Appendix A Invoice and the generated Invoices.
 * Every insert uses ON CONFLICT DO NOTHING, and an Invoice Item is inserted only
 * when its Invoice was, so a second run changes nothing.
 */
export async function seedDatabase(
  dataSource: DataSource,
  options: SeedOptions,
): Promise<{ invoicesInserted: number }> {
  await dataSource.runMigrations({ transaction: 'each' });
  const passwordHash = await new PasswordHasher().hash(options.user.password);
  const seeds = [
    APPENDIX_A_INVOICE,
    ...generateInvoices(options.today, options.now, DEFAULT_USER_ID),
  ];

  return dataSource.transaction(async (manager) => {
    if (options.reset) {
      await manager.query('TRUNCATE TABLE invoices CASCADE');
    }
    await manager.upsert(
      User,
      {
        id: DEFAULT_USER_ID,
        email: options.user.email.toLowerCase(),
        passwordHash,
        fullname: options.user.fullname,
      },
      ['id'],
    );

    let invoicesInserted = 0;
    for (const seed of seeds) {
      const inserted = await manager
        .createQueryBuilder()
        .insert()
        .into(Invoice)
        .values(toInvoiceRow(seed))
        .orIgnore()
        .execute();
      // RETURNING yields no row when ON CONFLICT DO NOTHING skipped the insert.
      if ((inserted.raw as unknown[]).length === 0) continue;

      await manager
        .createQueryBuilder()
        .insert()
        .into(InvoiceItem)
        .values({
          id: seed.item.id,
          invoiceId: seed.invoiceId,
          name: seed.item.name,
          quantity: seed.item.quantity,
          rate: new Decimal(seed.item.rate),
        })
        .orIgnore()
        .execute();
      invoicesInserted += 1;
    }
    return { invoicesInserted };
  });
}

function toInvoiceRow(seed: SeedInvoice) {
  const totals = calculateInvoiceTotals({
    items: [seed.item],
    taxRate: seed.taxRate,
    discount: seed.discount,
    totalPaid: seed.totalPaid,
  });
  return {
    invoiceId: seed.invoiceId,
    invoiceNumber: seed.invoiceNumber,
    invoiceReference: seed.invoiceReference,
    invoiceDate: seed.invoiceDate,
    dueDate: seed.dueDate,
    currency: seed.currency,
    currencySymbol: CURRENCY_SYMBOLS[seed.currency],
    description: seed.description,
    status: seed.status,
    customerFullname: seed.customer.fullname,
    customerEmail: seed.customer.email,
    customerMobileNumber: seed.customer.mobileNumber,
    customerAddress: seed.customer.address,
    taxRate: new Decimal(seed.taxRate),
    invoiceSubTotal: totals.subTotal,
    totalTax: totals.taxAmount,
    totalDiscount: totals.discount,
    totalAmount: totals.totalAmount,
    totalPaid: totals.totalPaid,
    balanceAmount: totals.balanceAmount,
    createdAt: seed.createdAt,
    createdBy: seed.createdBy,
  };
}
