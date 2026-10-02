import { Decimal } from 'decimal.js';
import { deriveInvoiceStatus } from './domain/invoice-status.js';
import type { InvoiceDto, InvoiceItemDto } from './dto/invoice.dto.js';
import type { InvoiceItem } from './entities/invoice-item.entity.js';
import type { Invoice } from './entities/invoice.entity.js';

/** Money as a JSON number with at most 2 decimal places. */
function toMoney(value: Decimal): number {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

function toInvoiceItemDto(item: InvoiceItem): InvoiceItemDto {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    rate: toMoney(item.rate),
    amount: toMoney(item.rate.times(item.quantity)),
  };
}

/**
 * Maps an Invoice row and its loaded items to the API representation.
 * `today` (in APP_TIMEZONE) decides whether the Status is Overdue.
 */
export function toInvoiceDto(invoice: Invoice, today: string): InvoiceDto {
  return {
    invoiceId: invoice.invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    invoiceReference: invoice.invoiceReference,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    currencySymbol: invoice.currencySymbol,
    description: invoice.description,
    status: deriveInvoiceStatus(invoice.status, invoice.dueDate, today),
    customer: {
      fullname: invoice.customerFullname,
      email: invoice.customerEmail,
      mobileNumber: invoice.customerMobileNumber,
      address: invoice.customerAddress,
    },
    items: invoice.items.map(toInvoiceItemDto),
    taxRate: invoice.taxRate.toNumber(),
    invoiceSubTotal: toMoney(invoice.invoiceSubTotal),
    totalTax: toMoney(invoice.totalTax),
    totalDiscount: toMoney(invoice.totalDiscount),
    totalAmount: toMoney(invoice.totalAmount),
    totalPaid: toMoney(invoice.totalPaid),
    balanceAmount: toMoney(invoice.balanceAmount),
    createdAt: invoice.createdAt.toISOString(),
    createdBy: invoice.createdBy,
  };
}
