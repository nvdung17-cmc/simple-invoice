import { plainToInstance } from 'class-transformer';
import { type ValidationError, validateSync } from 'class-validator';
import { CreateInvoiceDto } from './create-invoice.dto.js';

const VALID = {
  customer: {
    fullname: 'Paul',
    email: 'paul@101digital.io',
    mobileNumber: '947717364111',
    address: 'Singapore',
  },
  invoiceNumber: 'IV-2026/10.001#A_1',
  invoiceReference: '#5721662',
  invoiceDate: '2026-10-02',
  dueDate: '2026-11-01',
  currency: 'AUD',
  description: 'Invoice is issued to Kanglee',
  items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
  taxRate: 10,
  discount: 20,
};

/** Flattens nested errors to messages such as "items.0.rate …", like the ValidationPipe. */
function flatten(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) =>
      parent ? `${parent}.${message}` : message,
    );
    return [...own, ...flatten(error.children ?? [], path)];
  });
}

function parse(body: Record<string, unknown>) {
  const dto = plainToInstance(CreateInvoiceDto, body);
  const errors = validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, messages: flatten(errors) };
}

describe('CreateInvoiceDto', () => {
  it('accepts a valid Invoice', () => {
    expect(parse(VALID).messages).toEqual([]);
  });

  it('defaults the Tax Rate to 10 and the discount to 0', () => {
    const body: Record<string, unknown> = { ...VALID };
    delete body.taxRate;
    delete body.discount;
    const { dto, messages } = parse(body);
    expect(messages).toEqual([]);
    expect(dto.taxRate).toBe(10);
    expect(dto.discount).toBe(0);
  });

  it('trims strings, upper-cases the currency and drops blank optional fields', () => {
    const { dto, messages } = parse({
      ...VALID,
      customer: {
        fullname: '  Paul  ',
        email: ' paul@101digital.io ',
        mobileNumber: '  ',
        address: '',
      },
      invoiceNumber: ' INV-1 ',
      invoiceReference: '   ',
      description: '',
      invoiceDate: ' 2026-10-02 ',
      currency: ' usd ',
    });
    expect(messages).toEqual([]);
    expect(dto.customer.fullname).toBe('Paul');
    expect(dto.customer.email).toBe('paul@101digital.io');
    expect(dto.customer.mobileNumber).toBeUndefined();
    expect(dto.customer.address).toBeUndefined();
    expect(dto.invoiceNumber).toBe('INV-1');
    expect(dto.invoiceReference).toBeUndefined();
    expect(dto.description).toBeUndefined();
    expect(dto.invoiceDate).toBe('2026-10-02');
    expect(dto.currency).toBe('USD');
  });

  const item = VALID.items[0];
  const invalidBodies: Array<[string, Record<string, unknown>, string]> = [
    [
      'a Due Date before the Invoice Date',
      { dueDate: '2026-10-01' },
      'dueDate must be on or after invoiceDate',
    ],
    [
      'a date that does not exist',
      { invoiceDate: '2026-02-30' },
      'invoiceDate must be a valid date in YYYY-MM-DD format',
    ],
    ['no item', { items: [] }, 'items must contain exactly 1 item'],
    ['two items', { items: [item, item] }, 'items must contain exactly 1 item'],
    [
      'a quantity of 0',
      { items: [{ ...item, quantity: 0 }] },
      'items.0.quantity must not be less than 1',
    ],
    [
      'a fractional quantity',
      { items: [{ ...item, quantity: 1.5 }] },
      'items.0.quantity must be an integer number',
    ],
    [
      'a Rate of 0',
      { items: [{ ...item, rate: 0 }] },
      'items.0.rate must be a positive number',
    ],
    [
      'a Rate with 3 decimal places',
      { items: [{ ...item, rate: 1.005 }] },
      'items.0.rate must have at most 2 decimal places',
    ],
    [
      'a tiny Rate in exponent notation',
      { items: [{ ...item, rate: 1e-7 }] },
      'items.0.rate must have at most 2 decimal places',
    ],
    [
      'a Rate above 1,000,000',
      { items: [{ ...item, rate: 1_000_000.01 }] },
      'items.0.rate must not be greater than 1000000',
    ],
    [
      'a blank item name',
      { items: [{ ...item, name: '   ' }] },
      'items.0.name should not be empty',
    ],
    ['a negative Tax Rate', { taxRate: -1 }, 'taxRate must not be less than 0'],
    [
      'a Tax Rate above 100',
      { taxRate: 100.5 },
      'taxRate must not be greater than 100',
    ],
    [
      'a null Tax Rate',
      { taxRate: null },
      'taxRate must be a number conforming to the specified constraints',
    ],
    [
      'a discount above the sub-total plus tax',
      { discount: 2200.01 },
      'discount must not exceed the sub-total plus tax',
    ],
    [
      'a negative discount',
      { discount: -1 },
      'discount must not be less than 0',
    ],
    [
      'an invalid Customer email',
      { customer: { ...VALID.customer, email: 'paul' } },
      'customer.email must be an email',
    ],
    [
      'a blank Customer name',
      { customer: { ...VALID.customer, fullname: '  ' } },
      'customer.fullname should not be empty',
    ],
    [
      'a mobile number with letters',
      { customer: { ...VALID.customer, mobileNumber: '0912-ABC-789' } },
      'customer.mobileNumber must contain only digits, spaces, "-", "(" and ")", with an optional leading "+"',
    ],
    [
      'a mobile number that is too short',
      { customer: { ...VALID.customer, mobileNumber: '12345' } },
      'customer.mobileNumber must be longer than or equal to 6 characters',
    ],
    ['no Customer', { customer: undefined }, 'customer must be an object'],
    [
      'an Invoice Number with a space',
      { invoiceNumber: 'INV 1' },
      'invoiceNumber must start with a letter or digit and contain only letters, digits and - _ / . #',
    ],
    [
      'an Invoice Number over 50 characters',
      { invoiceNumber: 'A'.repeat(51) },
      'invoiceNumber must be shorter than or equal to 50 characters',
    ],
    [
      'an unsupported currency',
      { currency: 'XXX' },
      'currency must be one of: AUD, USD, GBP, EUR, SGD, NZD, CAD, HKD',
    ],
    [
      'an unknown field',
      { status: 'Paid' },
      'property status should not exist',
    ],
    [
      'a total sent by the caller',
      { totalAmount: 1 },
      'property totalAmount should not exist',
    ],
  ];

  it.each(invalidBodies)('rejects %s', (_case, overrides, message) => {
    expect(parse({ ...VALID, ...overrides }).messages).toContain(message);
  });

  // The free-text fields that no format validator guards: a NUL character
  // (U+0000) would reach PostgreSQL and answer 500 instead of 400. The title
  // shows only the field path, so no raw NUL lands in a test title.
  const nulBodies: Array<[string, Record<string, unknown>]> = [
    [
      'customer.fullname',
      { customer: { ...VALID.customer, fullname: 'a\u0000b' } },
    ],
    [
      'customer.address',
      { customer: { ...VALID.customer, address: 'a\u0000b' } },
    ],
    ['items.0.name', { items: [{ ...item, name: 'a\u0000b' }] }],
    ['invoiceReference', { invoiceReference: 'a\u0000b' }],
    ['description', { description: 'a\u0000b' }],
  ];

  it.each(nulBodies)('rejects a NUL character in %s', (field, overrides) => {
    expect(parse({ ...VALID, ...overrides }).messages).toEqual([
      `${field} must not contain a NUL character`,
    ]);
  });

  // PostgreSQL varchar(n) counts code points, but validator.js isLength (so
  // @MaxLength) counts "character + U+FE0F" as one. A text one code point over
  // the limit then passed validation and answered 500. HEART is two code points.
  const HEART = '\u{2764}\u{FE0F}';
  const tooLongBodies: Array<[string, number, Record<string, unknown>]> = [
    [
      'customer.fullname',
      255,
      { customer: { ...VALID.customer, fullname: 'x'.repeat(254) + HEART } },
    ],
    [
      'customer.email',
      255,
      { customer: { ...VALID.customer, email: 'x'.repeat(254) + HEART } },
    ],
    [
      'customer.address',
      500,
      { customer: { ...VALID.customer, address: 'x'.repeat(499) + HEART } },
    ],
    [
      'items.0.name',
      255,
      { items: [{ ...item, name: 'x'.repeat(254) + HEART }] },
    ],
    ['invoiceReference', 100, { invoiceReference: 'x'.repeat(99) + HEART }],
    ['description', 1000, { description: 'x'.repeat(999) + HEART }],
  ];

  // The email is not a valid address either, so it also draws "must be an email".
  it.each(tooLongBodies)(
    'rejects %s over %d code points',
    (field, limit, overrides) => {
      expect(parse({ ...VALID, ...overrides }).messages).toContain(
        `${field} must be shorter than or equal to ${limit} characters`,
      );
    },
  );

  it('accepts a text of exactly the limit in code points', () => {
    const description = 'x'.repeat(998) + HEART;
    expect(Array.from(description)).toHaveLength(1000);
    expect(parse({ ...VALID, description }).messages).toEqual([]);
  });
});
