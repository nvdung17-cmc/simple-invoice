import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** A person who signs in to SimpleInvoice and creates Invoices (CONTEXT.md, "User"). */
@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Unique regardless of case (`users_email_lower_uq`); stored in lower case. */
  @Column({ type: 'varchar', length: 255 })
  email: string;

  /** bcrypt hash. Not selected by default, so it can never leak into a response. */
  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 100,
    select: false,
  })
  passwordHash: string;

  @Column({ type: 'varchar', length: 255 })
  fullname: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
