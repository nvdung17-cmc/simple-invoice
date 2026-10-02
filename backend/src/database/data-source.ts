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
    // The migration creates pg_trgm itself and ids use gen_random_uuid(); TypeORM
    // would otherwise run CREATE EXTENSION "uuid-ossp" on every connect.
    installExtensions: false,
    // Failed queries are not logged here. Expected ones are normal (a duplicate
    // Invoice Number becomes a 409; the schema tests break constraints on
    // purpose), unexpected ones reach the global exception filter, which logs
    // them with the request, and TypeORM's own failure log would also write the
    // query parameters (Customer details, password hashes) to the logs.
    logging: ['warn'],
  };
}
