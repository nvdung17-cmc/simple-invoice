/**
 * Status rules (CONTEXT.md, "Status"). The Stored Status is Draft, Pending or
 * Paid; Overdue is computed when read and never stored. STATUS_CRITERIA
 * describes each Status as a condition on Stored Status and Due Date. The list
 * query builds its SQL from it, so the status filter can never disagree with
 * the Status an Invoice displays.
 */

export const STORED_STATUSES = ['Draft', 'Pending', 'Paid'] as const;
export type StoredStatus = (typeof STORED_STATUSES)[number];

export const INVOICE_STATUSES = [
  'Draft',
  'Pending',
  'Paid',
  'Overdue',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Where the Due Date must sit relative to today for a Status to apply. */
export type DuePosition = 'beforeToday' | 'todayOrLater' | 'any';

export interface StatusCriteria {
  storedIn: readonly StoredStatus[];
  due: DuePosition;
}

export const STATUS_CRITERIA: Readonly<Record<InvoiceStatus, StatusCriteria>> =
  {
    Draft: { storedIn: ['Draft'], due: 'todayOrLater' },
    Pending: { storedIn: ['Pending'], due: 'todayOrLater' },
    Paid: { storedIn: ['Paid'], due: 'any' },
    Overdue: { storedIn: ['Draft', 'Pending'], due: 'beforeToday' },
  };

/**
 * An Invoice that is not Paid and whose Due Date is before today is Overdue;
 * otherwise its Status is its Stored Status. ISO dates compare correctly as text.
 */
export function deriveInvoiceStatus(
  stored: StoredStatus,
  dueDate: string,
  today: string,
): InvoiceStatus {
  return stored !== 'Paid' && dueDate < today ? 'Overdue' : stored;
}

/** Evaluates STATUS_CRITERIA in TypeScript, mirroring the SQL predicate of the list query. */
export function matchesStatusCriteria(
  row: { status: StoredStatus; dueDate: string },
  criteria: StatusCriteria,
  today: string,
): boolean {
  if (!criteria.storedIn.includes(row.status)) return false;
  switch (criteria.due) {
    case 'beforeToday':
      return row.dueDate < today;
    case 'todayOrLater':
      return row.dueDate >= today;
    case 'any':
      return true;
  }
}
