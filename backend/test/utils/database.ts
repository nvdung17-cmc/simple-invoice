import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../../src/database/data-source.js';

/** A throwaway PostgreSQL 17 container and a DataSource on it (migrations not run yet). */
export interface TestDatabase {
  container: StartedPostgreSqlContainer;
  dataSource: DataSource;
}

export async function startDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer('postgres:17-alpine').start();
  const dataSource = new DataSource(
    buildDataSourceOptions(container.getConnectionUri()),
  );
  await dataSource.initialize();
  return { container, dataSource };
}

export async function stopDatabase(db?: TestDatabase): Promise<void> {
  await db?.dataSource.destroy();
  await db?.container.stop();
}
