import {
  deriveInvoiceStatus,
  INVOICE_STATUSES,
  matchesStatusCriteria,
  STATUS_CRITERIA,
  STORED_STATUSES,
} from './invoice-status.js';

const TODAY = '2026-09-15';

describe('deriveInvoiceStatus', () => {
  it('keeps Paid even when the Due Date has passed', () => {
    expect(deriveInvoiceStatus('Paid', '2026-09-01', TODAY)).toBe('Paid');
  });

  it.each(['Draft', 'Pending'] as const)(
    'reports a %s past its Due Date as Overdue',
    (stored) => {
      expect(deriveInvoiceStatus(stored, '2026-09-14', TODAY)).toBe('Overdue');
    },
  );

  it.each(STORED_STATUSES)('keeps %s when the Due Date is today', (stored) => {
    expect(deriveInvoiceStatus(stored, TODAY, TODAY)).toBe(stored);
  });

  it.each(STORED_STATUSES)(
    'keeps %s when the Due Date is in the future',
    (stored) => {
      expect(deriveInvoiceStatus(stored, '2026-10-01', TODAY)).toBe(stored);
    },
  );
});

describe('STATUS_CRITERIA', () => {
  const dueDates = { before: '2026-09-14', on: TODAY, after: '2026-09-16' };
  const rows = STORED_STATUSES.flatMap((status) =>
    Object.entries(dueDates).map(([position, dueDate]) => ({
      status,
      dueDate,
      position,
    })),
  );

  it.each(INVOICE_STATUSES)(
    'selects exactly the rows whose Status is %s',
    (status) => {
      for (const row of rows) {
        expect(
          matchesStatusCriteria(row, STATUS_CRITERIA[status], TODAY),
          `${row.status} due ${row.position} today`,
        ).toBe(deriveInvoiceStatus(row.status, row.dueDate, TODAY) === status);
      }
    },
  );

  it('places every row in exactly one Status', () => {
    for (const row of rows) {
      const matching = INVOICE_STATUSES.filter((status) =>
        matchesStatusCriteria(row, STATUS_CRITERIA[status], TODAY),
      );
      expect(matching).toHaveLength(1);
    }
  });
});
