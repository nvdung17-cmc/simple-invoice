// class-transformer's @Type() needs the reflect-metadata polyfill as soon as the
// decorators run. Nest and TypeORM load it, but this module also runs without
// them (its unit test, for example), so it loads the polyfill itself.
import 'reflect-metadata';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsTimeZone,
  Length,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Environment schema (§5.7), validated at start-up: the API and the seeder
 * refuse to run on a missing or invalid value. Secrets deliberately have no
 * defaults here; they must come from the environment (A§2.4.3).
 */

export const COOKIE_SECURE_MODES = ['auto', 'true', 'false'] as const;
export type CookieSecureMode = (typeof COOKIE_SECURE_MODES)[number];

/** Keys shared by the API, the seeder and the migration CLI. */
export class DatabaseEnvironmentVariables {
  @IsString()
  @Matches(/^postgres(ql)?:\/\/\S+$/, {
    message: 'DATABASE_URL must be a postgres:// connection URL',
  })
  DATABASE_URL: string;

  /** IANA time zone that defines "today" for the Overdue rule. */
  @IsTimeZone()
  APP_TIMEZONE: string = 'UTC';
}

/** Keys the API process reads. */
export class EnvironmentVariables extends DatabaseEnvironmentVariables {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters long' })
  JWT_SECRET: string;

  /** Token lifetime in seconds; jsonwebtoken would read a bare string as milliseconds. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  JWT_EXPIRES_IN: number = 3600;

  @IsIn(COOKIE_SECURE_MODES)
  COOKIE_SECURE: CookieSecureMode = 'auto';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  LOGIN_THROTTLE_LIMIT: number = 5;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  LOGIN_THROTTLE_TTL: number = 60;

  /** Express `trust proxy` value; the default trusts the bundled nginx on the private Docker network. */
  @IsString()
  @IsNotEmpty()
  TRUST_PROXY: string = 'loopback, linklocal, uniquelocal';
}

/** Keys the seeder reads in addition to the database keys. */
export class SeedEnvironmentVariables extends DatabaseEnvironmentVariables {
  @IsEmail()
  SEED_USER_EMAIL: string;

  @IsString()
  @Length(8, 128)
  SEED_USER_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  SEED_USER_FULLNAME: string;
}

/**
 * Validates raw env values against a schema class. Empty strings count as
 * unset, so `KEY=` in a .env file falls back to the default.
 *
 * @throws Error listing every invalid key.
 */
export function validateConfig<T extends object>(
  schema: new () => T,
  config: Record<string, unknown>,
): T {
  const present = Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== ''),
  );
  const instance = plainToInstance(schema, present);
  const errors = validateSync(instance);
  if (errors.length > 0) {
    const details = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );
    throw new Error(
      `Invalid environment configuration:\n- ${details.join('\n- ')}`,
    );
  }
  return instance;
}

/** The `validate` hook of `ConfigModule.forRoot`. */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  return validateConfig(EnvironmentVariables, config);
}

/**
 * Converts TRUST_PROXY into Express's `trust proxy` setting: booleans and hop
 * counts get their real types; anything else (an address list) stays a string.
 */
export function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}
