import type { CurrencyCode } from '../../invoices/domain/currencies.js';
import type { StoredStatus } from '../../invoices/domain/invoice-status.js';

/**
 * One seed Invoice with exactly one Invoice Item. Amounts are decimal strings;
 * the seeder computes the totals with calculateInvoiceTotals when inserting.
 */
export interface SeedInvoice {
  invoiceId: string;
  invoiceNumber: string;
  invoiceReference: string | null;
  invoiceDate: string;
  dueDate: string;
  currency: CurrencyCode;
  description: string | null;
  status: StoredStatus;
  customer: {
    fullname: string;
    email: string;
    mobileNumber: string | null;
    address: string | null;
  };
  item: { id: string; name: string; quantity: number; rate: string };
  taxRate: string;
  discount: string;
  totalPaid: string;
  createdAt: Date;
  createdBy: string;
}
