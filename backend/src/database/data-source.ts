import pg from 'pg';
import type { DataSourceOptions } from 'typeorm';
import { Invoice } from '../invoices/entities/invoice.entity.js';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity.js';
import { User } from '../users/user.entity.js';
import { InitialSchema1790812800000 } from './migrations/1790812800000-InitialSchema.js';

// Return DATE columns (type OID 1082) as 'YYYY-MM-DD' strings everywhere. By
// default pg turns them into local-midnight Date objects in raw queries, which
// shift with the host time zone.
pg.types.setTypeParser(1082, (value: string) => value);

/** One set of TypeORM options for the API, the seeder, the migration CLI and the tests. */
export function buildDataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities: [User, Invoice, InvoiceItem],
    migrations: [InitialSchema1790812800000],
    migrationsTableName: 'migrations',
    synchronize: false,
    logging: ['error', 'warn'],
  };
}
