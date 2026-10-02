import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ListInvoicesQueryDto } from './list-invoices-query.dto.js';

/** Transforms and validates like the global ValidationPipe does. */
function parse(query: Record<string, string>) {
  const dto = plainToInstance(ListInvoicesQueryDto, query);
  const errors = validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return {
    dto,
    messages: errors.flatMap((error) => Object.values(error.constraints ?? {})),
  };
}

describe('ListInvoicesQueryDto', () => {
  it('applies the defaults', () => {
    const { dto, messages } = parse({});
    expect(messages).toEqual([]);
    expect(dto).toMatchObject({ page: 1, pageSize: 10, ordering: 'DESC' });
    expect(dto.sortBy).toBeUndefined();
    expect(dto.status).toBeUndefined();
    expect(dto.keyword).toBeUndefined();
  });

  it('converts numbers and accepts any case for the ordering and the Status', () => {
    const { dto, messages } = parse({
      page: '3',
      pageSize: '25',
      sortBy: 'totalAmount',
      ordering: 'asc',
      status: 'overdue',
    });
    expect(messages).toEqual([]);
    expect(dto).toMatchObject({
      page: 3,
      pageSize: 25,
      sortBy: 'totalAmount',
      ordering: 'ASC',
      status: 'Overdue',
    });
  });

  it('trims the keyword and ignores blank optional filters', () => {
    const { dto, messages } = parse({
      keyword: '  acme ',
      status: ' ',
      sortBy: '',
      fromDate: '',
      toDate: '',
    });
    expect(messages).toEqual([]);
    expect(dto.keyword).toBe('acme');
    expect(dto.status).toBeUndefined();
    expect(dto.sortBy).toBeUndefined();
    expect(dto.fromDate).toBeUndefined();
    expect(dto.toDate).toBeUndefined();
  });

  const invalidQueries: Array<[Record<string, string>, string]> = [
    [{ page: '0' }, 'page must not be less than 1'],
    [{ page: 'two' }, 'page must be an integer number'],
    [{ page: '1e21' }, 'page must not be greater than 9007199254740991'],
    [{ pageSize: '101' }, 'pageSize must not be greater than 100'],
    [
      { sortBy: 'customer' },
      'sortBy must be one of the following values: invoiceDate, dueDate, totalAmount',
    ],
    [
      { ordering: 'up' },
      'ordering must be one of the following values: ASC, DESC',
    ],
    [
      { status: 'Late' },
      'status must be one of the following values: Draft, Pending, Paid, Overdue',
    ],
    [
      { keyword: 'x'.repeat(101) },
      'keyword must be shorter than or equal to 100 characters',
    ],
    [
      { fromDate: '2026-02-30' },
      'fromDate must be a valid date in YYYY-MM-DD format',
    ],
    [
      { fromDate: '2026-07-01', toDate: '2026-06-30' },
      'toDate must be on or after fromDate',
    ],
    [{ foo: 'bar' }, 'property foo should not exist'],
  ];

  it.each(invalidQueries)('rejects %o', (query, message) => {
    expect(parse(query).messages).toContain(message);
  });
});
