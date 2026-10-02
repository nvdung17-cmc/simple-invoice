import type { SeedInvoice } from './seed-invoice.js';

/** Appendix A's `createdBy`, reused as the id of the default User. */
export const DEFAULT_USER_ID = 'ad1e0902-1928-4345-b513-60c86c94fc91';

/**
 * The Appendix A Invoice, verbatim. The assessment's mock shows it as
 * "Overdue", which is never stored (CONTEXT.md, flagged ambiguities): it is
 * part-paid, so it was issued, and its Stored Status is Pending. It reads
 * Overdue because its Due Date has passed.
 */
export const APPENDIX_A_INVOICE: SeedInvoice = {
  invoiceId: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
  invoiceNumber: 'IV1780488206995',
  invoiceReference: '#5721662',
  invoiceDate: '2026-06-03',
  dueDate: '2026-07-03',
  currency: 'AUD',
  description: 'Invoice is issued to Kanglee',
  status: 'Pending',
  customer: {
    fullname: 'Paul',
    email: 'paul@101digital.io',
    mobileNumber: '947717364111',
    address: 'Singapore',
  },
  item: {
    id: 'b1c2d3e4-0000-0000-0000-000000000001',
    name: 'Honda RC150',
    quantity: 2,
    rate: '1000',
  },
  taxRate: '10',
  discount: '20',
  totalPaid: '1451.34',
  createdAt: new Date('2026-06-03T12:03:26.995Z'),
  createdBy: DEFAULT_USER_ID,
};
