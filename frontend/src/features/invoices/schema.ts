import type { FieldPath } from 'react-hook-form'
import { z } from 'zod'
import type { CreateInvoiceRequest } from '../../api/types'
import { CURRENCY_CODES } from '../../lib/currencies'
import { addDaysIso, isIsoDate } from '../../lib/dates'

/**
 * The create form's rules (spec §6.3). They mirror the API's (spec §5.3), so
 * most mistakes are caught before anything is sent. Two rules stay with the
 * API: the Invoice Number must be unique, and the Discount must not exceed the
 * Sub-total plus tax, because only the server computes totals. Their errors
 * come back as a 409 or a 400 and are shown on the field (`mapServerErrors`).
 */

const INVOICE_NUMBER = /^[A-Za-z0-9][A-Za-z0-9\-_/.#]*$/
const MOBILE_NUMBER = /^\+?[0-9\s\-()]+$/

// Not `value * 100`: it is inexact from 131,072 up, so it would reject amounts the API accepts.
const hasAtMostTwoDecimals = (value: number) => Number(value.toFixed(2)) === value

const blankToUndefined = (value: string) => value || undefined

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`)

/** An optional text field: a blank one is left out of the request. */
const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .transform(blankToUndefined)

/** A number typed into a text field. The input is a string; the output is a number. */
const numberText = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .pipe(z.coerce.number<string>(`${label} must be a number`))

const isoDate = (label: string) =>
  z.string().min(1, `${label} is required`).refine(isIsoDate, `${label} must be a valid date`)

export const createInvoiceSchema = z
  .object({
    customer: z.object({
      fullname: requiredText('Customer name', 255),
      email: requiredText('Email', 255).pipe(z.email('Enter a valid email address')),
      mobileNumber: z
        .string()
        .trim()
        .refine(
          (value) => value === '' || MOBILE_NUMBER.test(value),
          'Use digits, spaces, "-", "(" and ")", with an optional leading "+"',
        )
        .refine(
          (value) => value === '' || (value.length >= 6 && value.length <= 20),
          'Mobile number must be 6 to 20 characters',
        )
        .transform(blankToUndefined),
      address: optionalText('Address', 500),
    }),
    invoiceNumber: requiredText('Invoice number', 50).regex(
      INVOICE_NUMBER,
      'Start with a letter or digit; then use letters, digits and - _ / . #',
    ),
    invoiceReference: optionalText('Reference', 100),
    invoiceDate: isoDate('Invoice date'),
    dueDate: isoDate('Due date'),
    currency: z.enum(CURRENCY_CODES, 'Choose a currency'),
    description: optionalText('Description', 1000),
    item: z.object({
      name: requiredText('Item name', 255),
      quantity: numberText('Quantity').pipe(
        z
          .number()
          .int('Quantity must be a whole number')
          .min(1, 'Quantity must be at least 1')
          .max(1_000_000, 'Quantity must be at most 1,000,000'),
      ),
      rate: numberText('Rate').pipe(
        z
          .number()
          .positive('Rate must be greater than 0')
          .max(1_000_000, 'Rate must be at most 1,000,000')
          .refine(hasAtMostTwoDecimals, 'Rate must have at most 2 decimal places'),
      ),
    }),
    taxRate: numberText('Tax rate').pipe(
      z
        .number()
        .min(0, 'Tax rate must be between 0 and 100')
        .max(100, 'Tax rate must be between 0 and 100')
        .refine(hasAtMostTwoDecimals, 'Tax rate must have at most 2 decimal places'),
    ),
    // Optional: a blank Discount means 0, as it does for the API.
    discount: z
      .string()
      .trim()
      .transform((value) => value || '0')
      .pipe(z.coerce.number<string>('Discount must be a number'))
      .pipe(
        z
          .number()
          .min(0, 'Discount must not be negative')
          .refine(hasAtMostTwoDecimals, 'Discount must have at most 2 decimal places'),
      ),
  })
  .refine((values) => values.dueDate >= values.invoiceDate, {
    message: 'Due date must be on or after the invoice date',
    path: ['dueDate'],
    // Check the dates even while other fields are still invalid, as long as both dates are real.
    when: ({ value }) => {
      const { invoiceDate, dueDate } = value as { invoiceDate?: unknown; dueDate?: unknown }
      return (
        typeof invoiceDate === 'string' &&
        isIsoDate(invoiceDate) &&
        typeof dueDate === 'string' &&
        isIsoDate(dueDate)
      )
    },
  })

/** What the inputs hold: text, as typed. */
export type CreateInvoiceFormInput = z.input<typeof createInvoiceSchema>
/** What a valid form produces: trimmed text, numbers, and no blank optional fields. */
export type CreateInvoiceFormOutput = z.output<typeof createInvoiceSchema>
export type CreateInvoiceField = FieldPath<CreateInvoiceFormInput>

/** A new form: dated `today`, due 30 days later, in AUD at a 10 % Tax Rate (spec §6.3). */
export function createInvoiceDefaults(today: string): CreateInvoiceFormInput {
  return {
    customer: { fullname: '', email: '', mobileNumber: '', address: '' },
    invoiceNumber: '',
    invoiceReference: '',
    invoiceDate: today,
    dueDate: addDaysIso(today, 30),
    currency: 'AUD',
    description: '',
    item: { name: '', quantity: '1', rate: '' },
    taxRate: '10',
    discount: '0',
  }
}

/** The request body. The form has one item; the API takes a list of exactly one. */
export function toCreateInvoiceRequest(values: CreateInvoiceFormOutput): CreateInvoiceRequest {
  const { item, ...invoice } = values
  return { ...invoice, items: [item] }
}

/** API field paths and the form field and label each maps to, in the form's order. */
const SERVER_FIELDS = new Map<string, [CreateInvoiceField, string]>([
  ['customer.fullname', ['customer.fullname', 'Customer name']],
  ['customer.email', ['customer.email', 'Email']],
  ['customer.mobileNumber', ['customer.mobileNumber', 'Mobile number']],
  ['customer.address', ['customer.address', 'Address']],
  ['invoiceNumber', ['invoiceNumber', 'Invoice number']],
  ['invoiceReference', ['invoiceReference', 'Reference']],
  ['invoiceDate', ['invoiceDate', 'Invoice date']],
  ['dueDate', ['dueDate', 'Due date']],
  ['currency', ['currency', 'Currency']],
  ['description', ['description', 'Description']],
  ['items.0.name', ['item.name', 'Item name']],
  ['items.0.quantity', ['item.quantity', 'Quantity']],
  ['items.0.rate', ['item.rate', 'Rate']],
  ['taxRate', ['taxRate', 'Tax rate']],
  ['discount', ['discount', 'Discount']],
])

export interface ServerErrors {
  /** One message per field, in the form's order, so the first one can take the focus. */
  fieldErrors: Array<{ name: CreateInvoiceField; message: string }>
  /** Messages that name no form field. */
  formErrors: string[]
}

/**
 * Attaches the API's validation messages to form fields. A message starts
 * with the field's path (`items.0.rate must have …`); the path is replaced by
 * the field's label, so the User reads "Rate must have …".
 */
export function mapServerErrors(messages: string[]): ServerErrors {
  const byPath = new Map<string, string>()
  const formErrors: string[] = []
  for (const message of messages) {
    const [path, ...words] = message.split(' ')
    if (SERVER_FIELDS.has(path) && words.length > 0) {
      if (!byPath.has(path)) byPath.set(path, words.join(' '))
    } else {
      formErrors.push(message)
    }
  }
  const fieldErrors = [...SERVER_FIELDS]
    .filter(([path]) => byPath.has(path))
    .map(([path, [name, label]]) => ({ name, message: `${label} ${byPath.get(path)}` }))
  return { fieldErrors, formErrors }
}
