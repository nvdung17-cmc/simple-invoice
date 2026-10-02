import {
  calculateInvoiceTotals,
  DEFAULT_TAX_RATE,
  DiscountExceedsTotalError,
  type InvoiceTotals,
} from './invoice-totals.js';

/** Totals as 2-decimal strings, so expectations read like money. */
function asMoney(totals: InvoiceTotals): Record<keyof InvoiceTotals, string> {
  return {
    subTotal: totals.subTotal.toFixed(2),
    taxAmount: totals.taxAmount.toFixed(2),
    discount: totals.discount.toFixed(2),
    totalAmount: totals.totalAmount.toFixed(2),
    totalPaid: totals.totalPaid.toFixed(2),
    balanceAmount: totals.balanceAmount.toFixed(2),
  };
}

describe('calculateInvoiceTotals', () => {
  it('reproduces the Appendix A figures', () => {
    const totals = calculateInvoiceTotals({
      items: [{ quantity: 2, rate: 1000 }],
      taxRate: 10,
      discount: 20,
      totalPaid: '1451.34',
    });
    expect(asMoney(totals)).toEqual({
      subTotal: '2000.00',
      taxAmount: '200.00',
      discount: '20.00',
      totalAmount: '2180.00',
      totalPaid: '1451.34',
      balanceAmount: '728.66',
    });
  });

  it('applies the default 10 % Tax Rate', () => {
    expect(DEFAULT_TAX_RATE).toBe(10);
    const totals = calculateInvoiceTotals({
      items: [{ quantity: 1, rate: '250.00' }],
      taxRate: DEFAULT_TAX_RATE,
      discount: 0,
    });
    expect(totals.taxAmount.toFixed(2)).toBe('25.00');
    expect(totals.totalAmount.toFixed(2)).toBe('275.00');
  });

  it('charges no tax at a 0 % Tax Rate', () => {
    const totals = calculateInvoiceTotals({
      items: [{ quantity: 4, rate: '12.50' }],
      taxRate: 0,
      discount: 0,
    });
    expect(totals.taxAmount.toFixed(2)).toBe('0.00');
    expect(totals.totalAmount.toFixed(2)).toBe('50.00');
  });

  it('rounds the Tax Amount half-up to the cent', () => {
    const tie = calculateInvoiceTotals({
      items: [{ quantity: 1, rate: '0.05' }],
      taxRate: 10,
      discount: 0,
    });
    expect(tie.taxAmount.toFixed(2)).toBe('0.01');

    const other = calculateInvoiceTotals({
      items: [{ quantity: 1, rate: '33.33' }],
      taxRate: '7.5',
      discount: 0,
    });
    expect(other.taxAmount.toFixed(2)).toBe('2.50');
  });

  it('avoids binary floating-point errors (0.1 × 3 = 0.30)', () => {
    const totals = calculateInvoiceTotals({
      items: [{ quantity: 3, rate: 0.1 }],
      taxRate: 0,
      discount: 0,
    });
    expect(totals.subTotal.equals('0.3')).toBe(true);
    expect(totals.subTotal.toFixed(2)).toBe('0.30');
  });

  it('sums several Invoice Items into the Sub-total', () => {
    const totals = calculateInvoiceTotals({
      items: [
        { quantity: 2, rate: '10.50' },
        { quantity: 3, rate: '1.25' },
      ],
      taxRate: 10,
      discount: 0,
    });
    expect(totals.subTotal.toFixed(2)).toBe('24.75');
    expect(totals.taxAmount.toFixed(2)).toBe('2.48');
  });

  it('allows a Discount equal to the Sub-total plus Tax Amount (Total Amount 0)', () => {
    const totals = calculateInvoiceTotals({
      items: [{ quantity: 1, rate: 100 }],
      taxRate: 10,
      discount: 110,
    });
    expect(totals.totalAmount.toFixed(2)).toBe('0.00');
    expect(totals.balanceAmount.toFixed(2)).toBe('0.00');
  });

  it('rejects a Discount above the Sub-total plus Tax Amount', () => {
    const call = () =>
      calculateInvoiceTotals({
        items: [{ quantity: 1, rate: 100 }],
        taxRate: 10,
        discount: '110.01',
      });
    expect(call).toThrow(DiscountExceedsTotalError);
    expect(call).toThrow('discount must not exceed the sub-total plus tax');
  });

  it('computes the Balance from the Total Paid, which defaults to 0', () => {
    const unpaid = calculateInvoiceTotals({
      items: [{ quantity: 1, rate: 100 }],
      taxRate: 10,
      discount: 0,
    });
    expect(unpaid.totalPaid.toFixed(2)).toBe('0.00');
    expect(unpaid.balanceAmount.toFixed(2)).toBe('110.00');

    const partPaid = calculateInvoiceTotals({
      items: [{ quantity: 1, rate: 100 }],
      taxRate: 10,
      discount: 0,
      totalPaid: '60.50',
    });
    expect(partPaid.balanceAmount.toFixed(2)).toBe('49.50');
  });
});
