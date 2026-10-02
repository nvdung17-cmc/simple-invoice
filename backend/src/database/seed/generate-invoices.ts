import { Decimal } from 'decimal.js';
import { addDays } from '../../common/iso-date.js';
import type { CurrencyCode } from '../../invoices/domain/currencies.js';
import type { StoredStatus } from '../../invoices/domain/invoice-status.js';
import { calculateInvoiceTotals } from '../../invoices/domain/invoice-totals.js';
import type { SeedInvoice } from './seed-invoice.js';

/**
 * Deterministic demo Invoices (spec §5.8). A fixed-seed PRNG (no faker) makes
 * every run produce the same data for the same day. Dates are relative to
 * `today`, so Overdue stays meaningful whenever the stack starts.
 */

export const GENERATED_INVOICE_COUNT = 40;

const PRNG_SEED = 20261002;

/** About 20 names that overlap partially, for the search demo. */
const CUSTOMER_NAMES = [
  'Nguyen Van An',
  'Nguyen Thi Binh',
  'Tran Minh Chau',
  'Le Hoang Dung',
  'Pham Thu Ha',
  'Acme Corp',
  'Acme Pty Ltd',
  'Globex Corporation',
  'Globex Asia',
  'Initech',
  'Umbrella Holdings',
  'Stark Industries',
  'Wayne Enterprises',
  'Wayne Logistics',
  'Kanglee Trading',
  'Paul Tan',
  'Paula Smith',
  'Sarah Connor',
  'Sarah Lee',
  'Oceanic Airlines',
];

const ITEM_NAMES = [
  'Website redesign',
  'Monthly hosting',
  'Consulting hours',
  'Mobile app sprint',
  'Logo design',
  'SEO audit',
  'Cloud migration',
  'Support retainer',
  'Analytics report',
  'Security review',
];

const ADDRESSES = [
  '12 George St, Sydney NSW 2000',
  '200 Collins St, Melbourne VIC 3000',
  '88 Market St, Singapore 048948',
  '5 Queen St, Auckland 1010',
  '1 Le Duan, District 1, Ho Chi Minh City',
];

const DUE_OFFSETS = [0, 7, 14, 30, 45, 60];
const OTHER_CURRENCIES: CurrencyCode[] = ['USD', 'SGD', 'GBP', 'EUR'];

interface InvoicePlan {
  status: StoredStatus;
  /** Days from today to the Invoice Date. */
  invoiceOffset: number;
  /** Days from the Invoice Date to the Due Date. */
  dueOffset: number;
}

/** Edge cases that are always present, whatever the PRNG produces. */
const FIXED_PLANS: InvoicePlan[] = [
  { status: 'Draft', invoiceOffset: -40, dueOffset: 30 }, // Overdue Draft
  { status: 'Pending', invoiceOffset: -60, dueOffset: 30 }, // Overdue Pending
  { status: 'Pending', invoiceOffset: -14, dueOffset: 14 }, // due today: not Overdue
  { status: 'Paid', invoiceOffset: -90, dueOffset: 30 }, // Paid past its Due Date: not Overdue
  { status: 'Draft', invoiceOffset: 5, dueOffset: 30 }, // future-dated Draft
];

/** With the fixed cases: 14 Paid (35 %), 16 Pending (40 %), 10 Draft (25 %). */
const RANDOM_STATUSES: StoredStatus[] = [
  ...Array<StoredStatus>(13).fill('Paid'),
  ...Array<StoredStatus>(14).fill('Pending'),
  ...Array<StoredStatus>(8).fill('Draft'),
];

interface Random {
  int(min: number, max: number): number;
  pick<T>(values: readonly T[]): T;
  chance(probability: number): boolean;
}

/** mulberry32: a small, well-known 32-bit PRNG returning floats in [0, 1). */
function createRandom(seed: number): Random {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    int: (min: number, max: number) =>
      min + Math.floor(next() * (max - min + 1)),
    pick: <T>(values: readonly T[]): T =>
      values[Math.floor(next() * values.length)],
    chance: (probability: number) => next() < probability,
  };
}

function shuffle<T>(values: readonly T[], random: Random): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = random.int(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function generateInvoices(
  today: string,
  now: Date,
  createdBy: string,
): SeedInvoice[] {
  const random = createRandom(PRNG_SEED);
  const plans: InvoicePlan[] = [
    ...FIXED_PLANS,
    ...shuffle(RANDOM_STATUSES, random).map((status) => ({
      status,
      // Only a Draft may be dated in the future (up to 10 days ahead).
      invoiceOffset:
        status === 'Draft' ? random.int(-180, 10) : random.int(-180, 0),
      dueOffset: random.pick(DUE_OFFSETS),
    })),
  ];
  return plans.map((plan, index) =>
    buildInvoice(index + 1, plan, today, now, createdBy, random),
  );
}

function buildInvoice(
  n: number,
  plan: InvoicePlan,
  today: string,
  now: Date,
  createdBy: string,
  random: Random,
): SeedInvoice {
  const invoiceDate = addDays(today, plan.invoiceOffset);
  const dueDate = addDays(invoiceDate, plan.dueOffset);
  const fullname = random.pick(CUSTOMER_NAMES);
  const itemName = random.pick(ITEM_NAMES);
  const quantity = random.int(1, 50);
  const rate = new Decimal(random.int(500, 500_000)).dividedBy(100).toFixed(2);
  const taxRate = random.chance(0.7) ? '10' : random.pick(['0', '7.5', '15']);
  const subTotal = new Decimal(rate).times(quantity);
  const discount = random.chance(0.75)
    ? '0'
    : subTotal
        .times(random.int(5, 10))
        .dividedBy(100)
        .toDecimalPlaces(2, Decimal.ROUND_DOWN)
        .toFixed(2);
  const { totalAmount } = calculateInvoiceTotals({
    items: [{ quantity, rate }],
    taxRate,
    discount,
  });
  const totalPaid = paidAmount(plan.status, totalAmount, random);
  const currency: CurrencyCode = random.chance(0.6)
    ? 'AUD'
    : random.pick(OTHER_CURRENCIES);
  const invoiceReference = random.chance(0.5)
    ? `PO-${random.int(10000, 99999)}`
    : null;
  const mobileNumber = random.chance(0.7)
    ? `+61 4${random.int(10, 99)} ${random.int(100, 999)} ${random.int(100, 999)}`
    : null;
  const address = random.chance(0.7) ? random.pick(ADDRESSES) : null;
  const description = random.chance(0.6) ? `${itemName} for ${fullname}` : null;
  const createdAt = createdAtFor(invoiceDate, now, random);
  const idSuffix = String(n).padStart(12, '0');

  return {
    invoiceId: `5eed0000-0000-4000-8000-${idSuffix}`,
    invoiceNumber: `INV-${String(n).padStart(4, '0')}`,
    invoiceReference,
    invoiceDate,
    dueDate,
    currency,
    description,
    status: plan.status,
    customer: {
      fullname,
      email: `${emailLocalPart(fullname)}@example.com`,
      mobileNumber,
      address,
    },
    item: {
      id: `5eed0000-0000-4000-9000-${idSuffix}`,
      name: itemName,
      quantity,
      rate,
    },
    taxRate,
    discount,
    totalPaid: totalPaid.toFixed(2),
    createdAt,
    createdBy,
  };
}

/** Paid in full, part-paid (some Pending Invoices) or nothing paid yet. */
function paidAmount(
  status: StoredStatus,
  totalAmount: Decimal,
  random: Random,
): Decimal {
  if (status === 'Paid') return totalAmount;
  if (status === 'Pending' && random.chance(0.5)) {
    return totalAmount
      .times(random.pick([0.25, 0.5, 0.75]))
      .toDecimalPlaces(2, Decimal.ROUND_DOWN);
  }
  return new Decimal(0);
}

/**
 * A working-hours time on the Invoice Date, but never later than `now`, so the
 * default "newest first" order roughly follows the Invoice Date.
 */
function createdAtFor(invoiceDate: string, now: Date, random: Random): Date {
  const createdAt = new Date(`${invoiceDate}T00:00:00.000Z`);
  createdAt.setUTCHours(
    random.int(9, 17),
    random.int(0, 59),
    random.int(0, 59),
  );
  return createdAt.getTime() > now.getTime() ? new Date(now) : createdAt;
}

function emailLocalPart(fullname: string): string {
  return fullname
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');
}
