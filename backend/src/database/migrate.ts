import { DataSource } from 'typeorm';
import {
  DatabaseEnvironmentVariables,
  validateConfig,
} from '../config/env.validation.js';
import { loadEnvFile } from '../config/load-env-file.js';
import { buildDataSourceOptions } from './data-source.js';

/**
 * Migration CLI: `npm run migration:run` and `npm run migration:revert`.
 * The API also applies pending migrations at start-up (`migrationsRun`).
 */
loadEnvFile();

const command = process.argv[2];
if (command !== 'run' && command !== 'revert') {
  console.error('Usage: node dist/database/migrate.js <run|revert>');
  process.exit(1);
}

const env = validateConfig(DatabaseEnvironmentVariables, process.env);
const dataSource = new DataSource(buildDataSourceOptions(env.DATABASE_URL));
await dataSource.initialize();
try {
  if (command === 'run') {
    const applied = await dataSource.runMigrations({ transaction: 'each' });
    console.log(
      applied.length > 0
        ? `Applied migrations: ${applied.map((m) => m.name).join(', ')}`
        : 'No pending migrations.',
    );
  } else {
    await dataSource.undoLastMigration({ transaction: 'each' });
    console.log('Reverted the last migration.');
  }
} finally {
  await dataSource.destroy();
}
