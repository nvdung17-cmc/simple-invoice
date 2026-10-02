import { DataSource } from 'typeorm';
import { todayIn } from '../../common/iso-date.js';
import {
  SeedEnvironmentVariables,
  validateConfig,
} from '../../config/env.validation.js';
import { loadEnvFile } from '../../config/load-env-file.js';
import { buildDataSourceOptions } from '../data-source.js';
import { seedDatabase } from './seeder.js';

/**
 * Seed entry point: `npm run seed` (idempotent) and `npm run seed:reset`
 * (`--reset`: truncates the Invoices first). Reads `.env` when present.
 */
loadEnvFile();
const env = validateConfig(SeedEnvironmentVariables, process.env);
const now = new Date();
const reset = process.argv.includes('--reset');

const dataSource = new DataSource(buildDataSourceOptions(env.DATABASE_URL));
await dataSource.initialize();
try {
  const { invoicesInserted } = await seedDatabase(dataSource, {
    user: {
      email: env.SEED_USER_EMAIL,
      password: env.SEED_USER_PASSWORD,
      fullname: env.SEED_USER_FULLNAME,
    },
    today: todayIn(env.APP_TIMEZONE, now),
    now,
    reset,
  });
  console.log(
    `Seed complete${reset ? ' (reset)' : ''}: default User ${env.SEED_USER_EMAIL.toLowerCase()}, ` +
      `${invoicesInserted} Invoice(s) inserted.`,
  );
} finally {
  await dataSource.destroy();
}
