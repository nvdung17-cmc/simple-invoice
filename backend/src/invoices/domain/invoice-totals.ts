import { Decimal } from 'decimal.js';

/**
 * Invoice money rules (CONTEXT.md, "Money"). Pure and framework-free: the
 * service, the create DTO's Discount check and the seeder all call this one
 * function, so the Total Amount is always computed the same way.
 */

export type DecimalInput = Decimal | number | string;

/** The Tax Rate applied when the User does not set one. */
export const DEFAULT_TAX_RATE = 10;

export class DiscountExceedsTotalError extends Error {
  constructor() {
    super('discount must not exceed the sub-total plus tax');
    this.name = 'DiscountExceedsTotalError';
  }
}

export interface TotalsInput {
  items: ReadonlyArray<{ quantity: number; rate: DecimalInput }>;
  taxRate: DecimalInput;
  discount: DecimalInput;
  totalPaid?: DecimalInput;
}

export interface InvoiceTotals {
  subTotal: Decimal;
  taxAmount: Decimal;
  discount: Decimal;
  totalAmount: Decimal;
  totalPaid: Decimal;
  balanceAmount: Decimal;
}

/**
 * Sub-total = Σ quantity × Rate. Tax Amount = Sub-total × Tax Rate ÷ 100,
 * rounded half-up to the cent. Total Amount = Sub-total + Tax Amount − Discount.
 * Balance = Total Amount − Total Paid. Decimal arithmetic keeps every cent exact.
 *
 * @throws DiscountExceedsTotalError when the Discount would make the Total Amount negative.
 */
export function calculateInvoiceTotals(input: TotalsInput): InvoiceTotals {
  const subTotal = input.items.reduce(
    (sum, item) => sum.plus(new Decimal(item.rate).times(item.quantity)),
    new Decimal(0),
  );
  const taxAmount = subTotal
    .times(input.taxRate)
    .dividedBy(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const discount = new Decimal(input.discount);
  const totalAmount = subTotal.plus(taxAmount).minus(discount);
  if (totalAmount.lt(0)) {
    throw new DiscountExceedsTotalError();
  }
  const totalPaid = new Decimal(input.totalPaid ?? 0);
  return {
    subTotal,
    taxAmount,
    discount,
    totalAmount,
    totalPaid,
    balanceAmount: totalAmount.minus(totalPaid),
  };
}
