import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { appOptions, applyAppSetup } from '../../src/app.setup.js';
import { ClockService } from '../../src/common/clock.service.js';
import { seedDatabase } from '../../src/database/seed/seeder.js';

/** The pinned "today" of every e2e run, so Overdue is deterministic. */
export const TEST_TODAY = '2026-09-15';
export const TEST_NOW = new Date('2026-09-15T10:00:00.000Z');
export const TEST_USER = {
  email: 'admin@example.com',
  password: 'Password123!',
  fullname: 'Admin User',
};

export interface TestContext {
  app: NestExpressApplication;
  container: StartedPostgreSqlContainer;
}

/**
 * Boots the real AppModule with the shared HTTP setup against a fresh
 * PostgreSQL container, then seeds it for TEST_TODAY: the real migrations,
 * seed and HTTP pipeline are under test.
 */
export async function startTestApp(): Promise<TestContext> {
  const container = await new PostgreSqlContainer('postgres:17-alpine').start();
  setTestEnv(container.getConnectionUri());
  const app = await createApp();
  await seedDatabase(app.get(DataSource), {
    user: TEST_USER,
    today: TEST_TODAY,
    now: TEST_NOW,
  });
  return { app, container };
}

export async function stopTestApp(context?: TestContext): Promise<void> {
  await context?.app.close();
  await context?.container.stop();
}

/** Every API key. The JWT secret is random per run: no secret lives in the code. */
function setTestEnv(databaseUrl: string): void {
  Object.assign(process.env, {
    DATABASE_URL: databaseUrl,
    JWT_SECRET: randomBytes(32).toString('base64'),
    JWT_EXPIRES_IN: '3600',
    COOKIE_SECURE: 'auto',
    APP_TIMEZONE: 'UTC',
    LOGIN_THROTTLE_LIMIT: '5',
    LOGIN_THROTTLE_TTL: '60',
    TRUST_PROXY: 'loopback, linklocal, uniquelocal',
    PORT: '3000',
  });
}

async function createApp(): Promise<NestExpressApplication> {
  // Imported only now: ConfigModule.forRoot validates process.env as soon as
  // app.module.ts is evaluated, so the env must be set first.
  const { AppModule } = await import('../../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ClockService)
    .useValue({ today: () => TEST_TODAY })
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    ...appOptions,
    logger: ['error', 'warn'],
  });
  applyAppSetup(app);
  await app.init();
  return app;
}

let clientCount = 0;

/**
 * A new client IP (TEST-NET-1) for each call, sent as X-Forwarded-For. The app
 * trusts the loopback proxy, so every login gets its own throttle bucket and
 * no test trips the login limit by accident.
 */
export function nextClientIp(): string {
  clientCount += 1;
  return `192.0.2.${clientCount}`;
}

/**
 * Signs in through the API and returns the token for `Authorization: Bearer`.
 * Only email and password are sent: the API rejects unknown fields with 400.
 */
export async function loginAs(
  server: App,
  { email, password }: { email: string; password: string } = TEST_USER,
): Promise<string> {
  const res = await request(server)
    .post('/auth/login')
    .set('X-Forwarded-For', nextClientIp())
    .send({ email, password })
    .expect(200);
  return (res.body as { accessToken: string }).accessToken;
}
