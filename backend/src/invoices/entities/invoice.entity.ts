import { Decimal } from 'decimal.js';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { decimalTransformer } from '../../database/decimal.transformer.js';
import {
  STORED_STATUSES,
  type StoredStatus,
} from '../domain/invoice-status.js';
import { InvoiceItem } from './invoice-item.entity.js';

/**
 * An Invoice with its Customer snapshot (ADR-0001) and the totals computed by
 * calculateInvoiceTotals when it was created. `status` is the Stored Status;
 * the Status shown to Users is derived from it and `dueDate` when read.
 */
@Entity({ name: 'invoices' })
export class Invoice {
  @PrimaryGeneratedColumn('uuid', { name: 'invoice_id' })
  invoiceId: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 50 })
  invoiceNumber: string;

  @Column({
    name: 'invoice_reference',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  invoiceReference: string | null;

  @Column({ name: 'invoice_date', type: 'date' })
  invoiceDate: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ name: 'currency_symbol', type: 'varchar', length: 8 })
  currencySymbol: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: [...STORED_STATUSES],
    enumName: 'invoice_status',
    default: 'Draft',
  })
  status: StoredStatus;

  @Column({ name: 'customer_fullname', type: 'varchar', length: 255 })
  customerFullname: string;

  @Column({ name: 'customer_email', type: 'varchar', length: 255 })
  customerEmail: string;

  @Column({
    name: 'customer_mobile_number',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  customerMobileNumber: string | null;

  @Column({
    name: 'customer_address',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  customerAddress: string | null;

  @Column({
    name: 'tax_rate',
    type: 'numeric',
    precision: 5,
    scale: 2,
    transformer: decimalTransformer,
  })
  taxRate: Decimal;

  @Column({
    name: 'invoice_sub_total',
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: decimalTransformer,
  })
  invoiceSubTotal: Decimal;

  @Column({
    name: 'total_tax',
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalTax: Decimal;

  @Column({
    name: 'total_discount',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  totalDiscount: Decimal;

  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalAmount: Decimal;

  @Column({
    name: 'total_paid',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  totalPaid: Decimal;

  @Column({
    name: 'balance_amount',
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: decimalTransformer,
  })
  balanceAmount: Decimal;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  /** The creating User's id. A plain column: no feature navigates to the User. */
  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: ['insert'] })
  items: Relation<InvoiceItem[]>;
}
