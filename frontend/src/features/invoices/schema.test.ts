import {
  createInvoiceDefaults,
  createInvoiceSchema,
  mapServerErrors,
  toCreateInvoiceRequest,
  type CreateInvoiceFormInput,
} from './schema'

const VALID: CreateInvoiceFormInput = {
  customer: {
    fullname: '  Kanglee Trading ',
    email: ' billing@kanglee.example ',
    mobileNumber: '+65 9477 1736',
    address: '',
  },
  invoiceNumber: 'INV-2026-0042',
  invoiceReference: '   ',
  invoiceDate: '2026-10-02',
  dueDate: '2026-11-01',
  currency: 'USD',
  description: '',
  item: { name: 'Consulting', quantity: '3', rate: '19.99' },
  taxRate: '10',
  discount: '1.97',
}

/** The first message on each path after `change` is applied to a valid form. */
function errorsAfter(change: (form: CreateInvoiceFormInput) => void): Record<string, string> {
  const form = structuredClone(VALID)
  change(form)
  const errors: Record<string, string> = {}
  for (const issue of createInvoiceSchema.safeParse(form).error?.issues ?? []) {
    errors[issue.path.join('.')] ??= issue.message
  }
  return errors
}

describe('createInvoiceSchema', () => {
  it('turns valid input into the request body', () => {
    const body = toCreateInvoiceRequest(createInvoiceSchema.parse(VALID))

    // Compare what is sent: blank optional fields must be left out, not sent as "".
    expect(JSON.parse(JSON.stringify(body))).toEqual({
      customer: {
        fullname: 'Kanglee Trading',
        email: 'billing@kanglee.example',
        mobileNumber: '+65 9477 1736',
      },
      invoiceNumber: 'INV-2026-0042',
      invoiceDate: '2026-10-02',
      dueDate: '2026-11-01',
      currency: 'USD',
      items: [{ name: 'Consulting', quantity: 3, rate: 19.99 }],
      taxRate: 10,
      discount: 1.97,
    })
  })

  it('starts a new form dated today and due in 30 days', () => {
    expect(createInvoiceDefaults('2026-10-02')).toMatchObject({
      invoiceDate: '2026-10-02',
      dueDate: '2026-11-01',
      currency: 'AUD',
      item: { name: '', quantity: '1', rate: '' },
      taxRate: '10',
      discount: '0',
    })
  })

  it.each<[string, (form: CreateInvoiceFormInput) => void, string, string]>([
    [
      'a blank Customer name',
      (form) => (form.customer.fullname = '  '),
      'customer.fullname',
      'Customer name is required',
    ],
    [
      'an invalid email',
      (form) => (form.customer.email = 'paul'),
      'customer.email',
      'Enter a valid email address',
    ],
    [
      'a mobile number with letters',
      (form) => (form.customer.mobileNumber = '0912-ABC-789'),
      'customer.mobileNumber',
      'Use digits, spaces, "-", "(" and ")", with an optional leading "+"',
    ],
    [
      'a short mobile number',
      (form) => (form.customer.mobileNumber = '12345'),
      'customer.mobileNumber',
      'Mobile number must be 6 to 20 characters',
    ],
    [
      'an Invoice Number with a space',
      (form) => (form.invoiceNumber = 'INV 1'),
      'invoiceNumber',
      'Start with a letter or digit; then use letters, digits and - _ / . #',
    ],
    [
      'a long Invoice Number',
      (form) => (form.invoiceNumber = 'A'.repeat(51)),
      'invoiceNumber',
      'Invoice number must be at most 50 characters',
    ],
    [
      'no Invoice Date',
      (form) => (form.invoiceDate = ''),
      'invoiceDate',
      'Invoice date is required',
    ],
    [
      'an impossible Due Date',
      (form) => (form.dueDate = '2026-02-30'),
      'dueDate',
      'Due date must be a valid date',
    ],
    [
      'a Due Date before the Invoice Date',
      (form) => (form.dueDate = '2026-10-01'),
      'dueDate',
      'Due date must be on or after the invoice date',
    ],
    [
      'a quantity that is not a number',
      (form) => (form.item.quantity = 'two'),
      'item.quantity',
      'Quantity must be a number',
    ],
    [
      'a fractional quantity',
      (form) => (form.item.quantity = '1.5'),
      'item.quantity',
      'Quantity must be a whole number',
    ],
    [
      'a quantity of 0',
      (form) => (form.item.quantity = '0'),
      'item.quantity',
      'Quantity must be at least 1',
    ],
    ['a blank Rate', (form) => (form.item.rate = ' '), 'item.rate', 'Rate is required'],
    ['a Rate of 0', (form) => (form.item.rate = '0'), 'item.rate', 'Rate must be greater than 0'],
    [
      'a Rate with 3 decimal places',
      (form) => (form.item.rate = '1.005'),
      'item.rate',
      'Rate must have at most 2 decimal places',
    ],
    [
      'a Tax Rate above 100',
      (form) => (form.taxRate = '100.5'),
      'taxRate',
      'Tax rate must be between 0 and 100',
    ],
    [
      'a negative Discount',
      (form) => (form.discount = '-1'),
      'discount',
      'Discount must not be negative',
    ],
    [
      'a Discount with 3 decimal places',
      (form) => (form.discount = '0.125'),
      'discount',
      'Discount must have at most 2 decimal places',
    ],
  ])('rejects %s', (_case, change, path, message) => {
    expect(errorsAfter(change)[path]).toBe(message)
  })

  // 131072.02 * 100 is 13107201.999999998 in floating point, yet the API accepts the amount.
  it.each<[string, (form: CreateInvoiceFormInput) => void]>([
    ['a Rate of 131072.02', (form) => (form.item.rate = '131072.02')],
    ['a Discount of 131072.02', (form) => (form.discount = '131072.02')],
  ])('accepts %s', (_case, change) => {
    expect(errorsAfter(change)).toEqual({})
  })

  it('checks the dates while other fields are still invalid', () => {
    expect(
      errorsAfter((form) => {
        form.customer.fullname = ''
        form.dueDate = '2026-10-01'
      }),
    ).toEqual({
      'customer.fullname': 'Customer name is required',
      dueDate: 'Due date must be on or after the invoice date',
    })
  })
})

describe('mapServerErrors', () => {
  it('puts each message on its field, labelled, in the form order', () => {
    expect(
      mapServerErrors([
        'discount must not exceed the sub-total plus tax',
        'items.0.rate must have at most 2 decimal places',
        'customer.email must be an email',
        'customer.email should not be empty',
        'property status should not exist',
      ]),
    ).toEqual({
      fieldErrors: [
        { name: 'customer.email', message: 'Email must be an email' },
        { name: 'item.rate', message: 'Rate must have at most 2 decimal places' },
        { name: 'discount', message: 'Discount must not exceed the sub-total plus tax' },
      ],
      formErrors: ['property status should not exist'],
    })
  })
})
