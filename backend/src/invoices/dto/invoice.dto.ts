import { ApiProperty } from '@nestjs/swagger';
import { CURRENCY_CODES } from '../domain/currencies.js';
import {
  INVOICE_STATUSES,
  type InvoiceStatus,
} from '../domain/invoice-status.js';

/** The Customer an Invoice is issued to, as recorded on the Invoice (ADR-0001). */
export class CustomerDto {
  @ApiProperty({ example: 'Paul' })
  fullname: string;

  @ApiProperty({ example: 'paul@101digital.io' })
  email: string;

  @ApiProperty({ type: String, nullable: true, example: '947717364111' })
  mobileNumber: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Singapore' })
  address: string | null;
}

/** The one Invoice Item of an Invoice. */
export class InvoiceItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Honda RC150' })
  name: string;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 1000, description: 'Rate: the price of one unit.' })
  rate: number;

  @ApiProperty({ example: 2000, description: 'quantity × rate' })
  amount: number;
}

/**
 * The single Invoice representation of the list, the detail view and create
 * (spec §5.3). Money fields are numbers with at most 2 decimal places; empty
 * optional fields are null.
 */
export class InvoiceDto {
  @ApiProperty({
    format: 'uuid',
    example: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
  })
  invoiceId: string;

  @ApiProperty({ example: 'IV1780488206995' })
  invoiceNumber: string;

  @ApiProperty({ type: String, nullable: true, example: '#5721662' })
  invoiceReference: string | null;

  @ApiProperty({ format: 'date', example: '2026-06-03' })
  invoiceDate: string;

  @ApiProperty({ format: 'date', example: '2026-07-03' })
  dueDate: string;

  @ApiProperty({ enum: CURRENCY_CODES, example: 'AUD' })
  currency: string;

  @ApiProperty({ example: 'AU$' })
  currencySymbol: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Invoice is issued to Kanglee',
  })
  description: string | null;

  @ApiProperty({
    enum: [...INVOICE_STATUSES],
    example: 'Overdue',
    description:
      'The Status. Overdue is computed: not Paid, and the Due Date is before today.',
  })
  status: InvoiceStatus;

  @ApiProperty({ type: CustomerDto })
  customer: CustomerDto;

  @ApiProperty({ type: [InvoiceItemDto] })
  items: InvoiceItemDto[];

  @ApiProperty({ example: 10, description: 'Tax Rate in percent.' })
  taxRate: number;

  @ApiProperty({
    example: 2000,
    description: 'Sub-total: the sum of the item amounts.',
  })
  invoiceSubTotal: number;

  @ApiProperty({ example: 200, description: 'Tax Amount, rounded half-up.' })
  totalTax: number;

  @ApiProperty({ example: 20 })
  totalDiscount: number;

  @ApiProperty({ example: 2180, description: 'Sub-total + tax − discount.' })
  totalAmount: number;

  @ApiProperty({ example: 1451.34 })
  totalPaid: number;

  @ApiProperty({ example: 728.66, description: 'Total Amount − Total Paid.' })
  balanceAmount: number;

  @ApiProperty({ format: 'date-time', example: '2026-06-03T12:03:26.995Z' })
  createdAt: string;

  @ApiProperty({
    format: 'uuid',
    example: 'ad1e0902-1928-4345-b513-60c86c94fc91',
    description: 'Id of the User who created the Invoice.',
  })
  createdBy: string;
}
