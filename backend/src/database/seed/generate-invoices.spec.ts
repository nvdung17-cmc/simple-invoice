import { addDays } from '../../common/iso-date.js';
import { deriveInvoiceStatus } from '../../invoices/domain/invoice-status.js';
import { calculateInvoiceTotals } from '../../invoices/domain/invoice-totals.js';
import { DEFAULT_USER_ID } from './appendix-a.js';
import {
  GENERATED_INVOICE_COUNT,
  generateInvoices,
} from './generate-invoices.js';

const TODAY = '2026-09-15';
const NOW = new Date('2026-09-15T10:00:00.000Z');

describe('generateInvoices', () => {
  const invoices = generateInvoices(TODAY, NOW, DEFAULT_USER_ID);

  it('produces the same Invoices for the same day', () => {
    expect(generateInvoices(TODAY, NOW, DEFAULT_USER_ID)).toEqual(invoices);
  });

  it('creates 40 Invoices numbered INV-0001 to INV-0040', () => {
    expect(GENERATED_INVOICE_COUNT).toBe(40);
    expect(invoices).toHaveLength(40);
    expect(invoices[0].invoiceNumber).toBe('INV-0001');
    expect(invoices[39].invoiceNumber).toBe('INV-0040');
  });

  it('uses unique ids and Invoice Numbers', () => {
    expect(new Set(invoices.map((i) => i.invoiceId)).size).toBe(40);
    expect(new Set(invoices.map((i) => i.item.id)).size).toBe(40);
    expect(new Set(invoices.map((i) => i.invoiceNumber)).size).toBe(40);
  });

  it('always includes the fixed edge cases', () => {
    const [overdueDraft, overduePending, dueToday, paidPastDue, futureDraft] =
      invoices;
    const statusOf = (invoice: (typeof invoices)[number]) =>
      deriveInvoiceStatus(invoice.status, invoice.dueDate, TODAY);

    expect(overdueDraft.status).toBe('Draft');
    expect(statusOf(overdueDraft)).toBe('Overdue');
    expect(overduePending.status).toBe('Pending');
    expect(statusOf(overduePending)).toBe('Overdue');
    expect(dueToday).toMatchObject({ status: 'Pending', dueDate: TODAY });
    expect(statusOf(dueToday)).toBe('Pending');
    expect(paidPastDue.status).toBe('Paid');
    expect(paidPastDue.dueDate < TODAY).toBe(true);
    expect(statusOf(paidPastDue)).toBe('Paid');
    expect(futureDraft.status).toBe('Draft');
    expect(futureDraft.invoiceDate > TODAY).toBe(true);
  });

  it('mixes Stored Statuses: 14 Paid, 16 Pending, 10 Draft', () => {
    const count = (status: string) =>
      invoices.filter((i) => i.status === status).length;
    expect([count('Paid'), count('Pending'), count('Draft')]).toEqual([
      14, 16, 10,
    ]);
  });

  it('produces consistent money: Paid means Balance 0, Draft means nothing paid', () => {
    for (const invoice of invoices) {
      const totals = calculateInvoiceTotals({
        items: [invoice.item],
        taxRate: invoice.taxRate,
        discount: invoice.discount,
        totalPaid: invoice.totalPaid,
      });
      expect(totals.balanceAmount.gte(0)).toBe(true);
      if (invoice.status === 'Paid') {
        expect(totals.balanceAmount.isZero()).toBe(true);
      }
      if (invoice.status === 'Draft') {
        expect(totals.totalPaid.isZero()).toBe(true);
      }
    }
  });

  it('keeps every value inside the create rules', () => {
    for (const invoice of invoices) {
      expect(invoice.item.quantity).toBeGreaterThanOrEqual(1);
      expect(invoice.item.quantity).toBeLessThanOrEqual(50);
      expect(invoice.item.rate).toMatch(/^\d+\.\d{2}$/);
      expect(Number(invoice.item.rate)).toBeGreaterThanOrEqual(5);
      expect(Number(invoice.item.rate)).toBeLessThanOrEqual(5000);
      expect(['0', '7.5', '10', '15']).toContain(invoice.taxRate);
      expect(invoice.customer.email).toMatch(/^[a-z0-9.]+@example\.com$/);
      if (invoice.customer.mobileNumber !== null) {
        expect(invoice.customer.mobileNumber).toMatch(/^\+?[0-9\s\-()]{6,20}$/);
      }
    }
  });

  it('keeps dates consistent and never creates anything in the future', () => {
    for (const invoice of invoices) {
      expect(invoice.dueDate >= invoice.invoiceDate).toBe(true);
      expect(invoice.invoiceDate >= addDays(TODAY, -180)).toBe(true);
      expect(invoice.invoiceDate <= addDays(TODAY, 10)).toBe(true);
      expect(invoice.createdAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
      expect(invoice.createdBy).toBe(DEFAULT_USER_ID);
    }
  });
});
