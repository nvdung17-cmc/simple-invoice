import { Decimal } from 'decimal.js';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { decimalTransformer } from '../../database/decimal.transformer.js';
import { Invoice } from './invoice.entity.js';

/**
 * One priced entry on an Invoice: a name, a whole-number quantity and a Rate.
 * Its amount (quantity × Rate) is computed when read, never stored.
 */
@Entity({ name: 'invoice_items' })
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Explicit FK column, so a page of Invoice Items loads with one `IN` query. */
  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Relation<Invoice>;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: decimalTransformer,
  })
  rate: Decimal;
}
