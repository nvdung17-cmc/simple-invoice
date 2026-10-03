import {
  EnvironmentVariables,
  parseTrustProxy,
  SeedEnvironmentVariables,
  validateConfig,
  validateEnv,
} from './env.validation.js';

const SECRET = 'x'.repeat(32);
const base = {
  DATABASE_URL: 'postgres://simple_invoice:pw@localhost:5432/simple_invoice',
  JWT_SECRET: SECRET,
};

describe('validateEnv', () => {
  it('applies the documented defaults', () => {
    const env = validateEnv(base);
    expect(env).toBeInstanceOf(EnvironmentVariables);
    expect(env).toMatchObject({
      PORT: 3000,
      JWT_EXPIRES_IN: 3600,
      COOKIE_SECURE: 'auto',
      APP_TIMEZONE: 'UTC',
      LOGIN_THROTTLE_LIMIT: 5,
      LOGIN_THROTTLE_TTL: 60,
      TRUST_PROXY: 'loopback, linklocal, uniquelocal',
    });
  });

  it('parses numbers from env strings (JWT_EXPIRES_IN is a number of seconds)', () => {
    const env = validateEnv({ ...base, PORT: '8081', JWT_EXPIRES_IN: '900' });
    expect(env.PORT).toBe(8081);
    expect(env.JWT_EXPIRES_IN).toBe(900);
  });

  it('treats empty values as unset, so the defaults apply', () => {
    const env = validateEnv({
      ...base,
      PORT: '',
      JWT_EXPIRES_IN: '',
      COOKIE_SECURE: '',
    });
    expect(env.PORT).toBe(3000);
    expect(env.JWT_EXPIRES_IN).toBe(3600);
    expect(env.COOKIE_SECURE).toBe('auto');
  });

  it('requires JWT_SECRET', () => {
    expect(() => validateEnv({ DATABASE_URL: base.DATABASE_URL })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    expect(() => validateEnv({ ...base, JWT_SECRET: 'x'.repeat(31) })).toThrow(
      'JWT_SECRET must be at least 32 characters long',
    );
  });

  it('requires a postgres DATABASE_URL', () => {
    expect(() => validateEnv({ JWT_SECRET: SECRET })).toThrow(/DATABASE_URL/);
    expect(() =>
      validateEnv({ ...base, DATABASE_URL: 'mysql://localhost/db' }),
    ).toThrow('DATABASE_URL must be a postgres:// connection URL');
  });

  it.each([
    ['JWT_EXPIRES_IN', '15m'],
    ['JWT_EXPIRES_IN', '0'],
    ['COOKIE_SECURE', 'yes'],
    ['APP_TIMEZONE', 'Mars/Olympus'],
    ['PORT', '70000'],
    ['LOGIN_THROTTLE_LIMIT', 'many'],
  ])('rejects %s=%s', (key, value) => {
    expect(() => validateEnv({ ...base, [key]: value })).toThrow(
      new RegExp(key),
    );
  });
});

describe('SeedEnvironmentVariables', () => {
  const seedEnv = {
    DATABASE_URL: base.DATABASE_URL,
    SEED_USER_EMAIL: 'admin@example.com',
    SEED_USER_PASSWORD: 'Password123!',
    SEED_USER_FULLNAME: 'Admin User',
  };

  it('accepts the seed keys without any API secret', () => {
    const env = validateConfig(SeedEnvironmentVariables, seedEnv);
    expect(env.SEED_USER_EMAIL).toBe('admin@example.com');
    expect(env.APP_TIMEZONE).toBe('UTC');
  });

  it('rejects a missing password and an invalid email', () => {
    expect(() =>
      validateConfig(SeedEnvironmentVariables, {
        ...seedEnv,
        SEED_USER_PASSWORD: '',
      }),
    ).toThrow(/SEED_USER_PASSWORD/);
    expect(() =>
      validateConfig(SeedEnvironmentVariables, {
        ...seedEnv,
        SEED_USER_EMAIL: 'admin',
      }),
    ).toThrow(/SEED_USER_EMAIL/);
  });

  it('rejects a password of more than 72 bytes, which bcrypt would cut short', () => {
    const withPassword = (SEED_USER_PASSWORD: string) =>
      validateConfig(SeedEnvironmentVariables, {
        ...seedEnv,
        SEED_USER_PASSWORD,
      });

    expect(withPassword('a'.repeat(72)).SEED_USER_PASSWORD).toHaveLength(72);
    expect(() => withPassword('a'.repeat(73))).toThrow(
      'SEED_USER_PASSWORD must be at most 72 bytes',
    );
  });
});

describe('parseTrustProxy', () => {
  it.each([
    ['true', true],
    ['false', false],
    ['1', 1],
    ['loopback, linklocal, uniquelocal', 'loopback, linklocal, uniquelocal'],
  ])('maps %s', (input, expected) => {
    expect(parseTrustProxy(input)).toBe(expected);
  });
});
