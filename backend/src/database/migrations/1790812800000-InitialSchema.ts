import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The initial schema (spec §4), in hand-written SQL so every constraint and
 * index is explicit. The CHECK constraints are a safety net: the API computes
 * the values. Overdue is not in the enum because it is never stored.
 */
export class InitialSchema1790812800000 implements MigrationInterface {
  name = 'InitialSchema1790812800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(
      `CREATE TYPE invoice_status AS ENUM ('Draft', 'Pending', 'Paid')`,
    );

    await queryRunner.query(`
      CREATE TABLE users (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        email varchar(255) NOT NULL,
        password_hash varchar(100) NOT NULL,
        fullname varchar(255) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT users_pkey PRIMARY KEY (id)
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email))`,
    );

    await queryRunner.query(`
      CREATE TABLE invoices (
        invoice_id uuid NOT NULL DEFAULT gen_random_uuid(),
        invoice_number varchar(50) NOT NULL,
        invoice_reference varchar(100),
        invoice_date date NOT NULL,
        due_date date NOT NULL,
        currency char(3) NOT NULL,
        currency_symbol varchar(8) NOT NULL,
        description varchar(1000),
        status invoice_status NOT NULL DEFAULT 'Draft',
        customer_fullname varchar(255) NOT NULL,
        customer_email varchar(255) NOT NULL,
        customer_mobile_number varchar(20),
        customer_address varchar(500),
        tax_rate numeric(5,2) NOT NULL,
        invoice_sub_total numeric(15,2) NOT NULL,
        total_tax numeric(15,2) NOT NULL,
        total_discount numeric(15,2) NOT NULL DEFAULT 0,
        total_amount numeric(15,2) NOT NULL,
        total_paid numeric(15,2) NOT NULL DEFAULT 0,
        balance_amount numeric(15,2) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        created_by uuid NOT NULL,
        CONSTRAINT invoices_pkey PRIMARY KEY (invoice_id),
        CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by)
          REFERENCES users (id) ON DELETE RESTRICT,
        CONSTRAINT invoices_due_date_check CHECK (due_date >= invoice_date),
        CONSTRAINT invoices_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
        CONSTRAINT invoices_tax_rate_check CHECK (tax_rate BETWEEN 0 AND 100),
        CONSTRAINT invoices_amounts_non_negative_check CHECK (
          invoice_sub_total >= 0 AND total_tax >= 0 AND total_discount >= 0
          AND total_amount >= 0 AND total_paid >= 0 AND balance_amount >= 0
        ),
        CONSTRAINT invoices_total_amount_check
          CHECK (total_amount = invoice_sub_total + total_tax - total_discount),
        CONSTRAINT invoices_balance_amount_check
          CHECK (balance_amount = total_amount - total_paid),
        CONSTRAINT invoices_total_paid_check CHECK (total_paid <= total_amount),
        CONSTRAINT invoices_paid_balance_check
          CHECK (status <> 'Paid' OR balance_amount = 0)
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX invoices_invoice_number_lower_uq ON invoices (lower(invoice_number))`,
    );
    await queryRunner.query(
      `CREATE INDEX invoices_invoice_number_trgm ON invoices USING gin (invoice_number gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX invoices_customer_fullname_trgm ON invoices USING gin (customer_fullname gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX invoices_invoice_date_idx ON invoices (invoice_date)`,
    );
    await queryRunner.query(
      `CREATE INDEX invoices_due_date_idx ON invoices (due_date)`,
    );
    await queryRunner.query(
      `CREATE INDEX invoices_total_amount_idx ON invoices (total_amount)`,
    );
    await queryRunner.query(
      `CREATE INDEX invoices_created_at_idx ON invoices (created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX invoices_status_due_date_idx ON invoices (status, due_date)`,
    );
    await queryRunner.query(
      `CREATE INDEX invoices_created_by_idx ON invoices (created_by)`,
    );

    await queryRunner.query(`
      CREATE TABLE invoice_items (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        invoice_id uuid NOT NULL,
        name varchar(255) NOT NULL,
        quantity integer NOT NULL,
        rate numeric(15,2) NOT NULL,
        CONSTRAINT invoice_items_pkey PRIMARY KEY (id),
        CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id)
          REFERENCES invoices (invoice_id) ON DELETE CASCADE,
        CONSTRAINT invoice_items_quantity_check CHECK (quantity > 0),
        CONSTRAINT invoice_items_rate_check CHECK (rate > 0)
      )`);
    await queryRunner.query(
      `CREATE INDEX invoice_items_invoice_id_idx ON invoice_items (invoice_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE invoice_items`);
    await queryRunner.query(`DROP TABLE invoices`);
    await queryRunner.query(`DROP TABLE users`);
    await queryRunner.query(`DROP TYPE invoice_status`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS pg_trgm`);
  }
}
