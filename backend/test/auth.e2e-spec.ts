import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DEFAULT_USER_ID } from '../src/database/seed/appendix-a.js';
import {
  loginAs,
  nextClientIp,
  startTestApp,
  stopTestApp,
  TEST_USER,
  type TestContext,
} from './utils/test-app.js';

const XHR = { 'X-Requested-With': 'XMLHttpRequest' };
const CREDENTIALS = { email: TEST_USER.email, password: TEST_USER.password };
const UNAUTHORIZED = {
  statusCode: 401,
  message: 'Unauthorized',
  error: 'Unauthorized',
};

function setCookies(res: request.Response): string[] {
  const header: unknown = res.headers['set-cookie'];
  return Array.isArray(header) ? (header as string[]) : [];
}

/** The full Set-Cookie line of the access-token cookie. */
function accessTokenCookie(res: request.Response): string {
  const cookie = setCookies(res).find((c) => c.startsWith('access_token='));
  if (!cookie) throw new Error('The response set no access_token cookie');
  return cookie;
}

/** The attributes of a Set-Cookie line, without the name=value pair. */
function cookieAttributes(cookie: string): string[] {
  return cookie
    .split(';')
    .slice(1)
    .map((attribute) => attribute.trim());
}

/** The `name=value` pair to send back in a Cookie header. */
function cookiePair(cookie: string): string {
  return cookie.split(';')[0];
}

describe('Auth (e2e)', () => {
  let context: TestContext;
  let server: App;

  beforeAll(async () => {
    context = await startTestApp();
    server = context.app.getHttpServer();
  });

  afterAll(async () => {
    await stopTestApp(context);
  });

  /** POST /auth/login from a new client IP. */
  function login(body: object, headers: Record<string, string> = {}) {
    return request(server)
      .post('/auth/login')
      .set('X-Forwarded-For', nextClientIp())
      .set(headers)
      .send(body);
  }

  async function signTestToken(
    payload: object,
    options: { expiresIn?: number; secret?: string } = {},
  ): Promise<string> {
    return context.app.get(JwtService).signAsync(payload, options);
  }

  describe('POST /auth/login', () => {
    it('returns the token and the User, and sets the httpOnly cookie', async () => {
      const res = await login(CREDENTIALS).expect(200);
      expect(res.body).toEqual({
        accessToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: {
          id: DEFAULT_USER_ID,
          email: 'admin@example.com',
          fullname: 'Admin User',
          createdAt: expect.any(String),
        },
      });
      const cookie = accessTokenCookie(res);
      expect(cookiePair(cookie)).toBe(`access_token=${res.body.accessToken}`);
      const attributes = cookieAttributes(cookie);
      expect(attributes).toEqual(
        expect.arrayContaining([
          'Max-Age=3600',
          'Path=/',
          'HttpOnly',
          'SameSite=Strict',
        ]),
      );
      expect(attributes).not.toContain('Secure');
    });

    it('accepts the email in any case and with surrounding spaces', async () => {
      await login({
        email: '  ADMIN@Example.com ',
        password: TEST_USER.password,
      }).expect(200);
    });

    it('marks the cookie Secure when the request came over HTTPS through the proxy', async () => {
      const res = await login(CREDENTIALS, {
        'X-Forwarded-Proto': 'https',
      }).expect(200);
      expect(cookieAttributes(accessTokenCookie(res))).toContain('Secure');
    });

    it('rejects a wrong password with 401 and the generic message', async () => {
      const res = await login({
        email: TEST_USER.email,
        password: 'wrong-password',
      }).expect(401);
      expect(res.body).toEqual({
        statusCode: 401,
        message: 'Invalid email or password',
        error: 'Unauthorized',
      });
      expect(setCookies(res)).toEqual([]);
    });

    it('gives an unknown email the same 401', async () => {
      const res = await login({
        email: 'nobody@example.com',
        password: TEST_USER.password,
      }).expect(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('rejects an invalid email with 400', async () => {
      const res = await login({ email: 'not-an-email', password: 'x' }).expect(
        400,
      );
      expect(res.body).toEqual({
        statusCode: 400,
        message: ['email must be an email'],
        error: 'Bad Request',
      });
    });

    it('does not parse form-encoded bodies (JSON only)', async () => {
      await request(server)
        .post('/auth/login')
        .set('X-Forwarded-For', nextClientIp())
        .type('form')
        .send(CREDENTIALS)
        .expect(400);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the User for a Bearer token', async () => {
      const token = await loginAs(server);
      const res = await request(server)
        .get('/auth/me')
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(res.body).toEqual({
        id: DEFAULT_USER_ID,
        email: 'admin@example.com',
        fullname: 'Admin User',
        createdAt: expect.any(String),
      });
    });

    it('accepts the cookie together with X-Requested-With', async () => {
      const cookie = cookiePair(
        accessTokenCookie(await login(CREDENTIALS).expect(200)),
      );
      await request(server)
        .get('/auth/me')
        .set('Cookie', cookie)
        .set(XHR)
        .expect(200);
    });

    it('rejects the cookie without X-Requested-With', async () => {
      const cookie = cookiePair(
        accessTokenCookie(await login(CREDENTIALS).expect(200)),
      );
      const res = await request(server)
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(401);
      expect(res.body).toEqual(UNAUTHORIZED);
    });

    it('rejects a request without a token', async () => {
      const res = await request(server).get('/auth/me').expect(401);
      expect(res.body).toEqual(UNAUTHORIZED);
    });

    it('rejects an expired token', async () => {
      const token = await signTestToken(
        { sub: DEFAULT_USER_ID, email: TEST_USER.email },
        { expiresIn: -10 },
      );
      await request(server)
        .get('/auth/me')
        .auth(token, { type: 'bearer' })
        .expect(401);
    });

    it('rejects a token signed with another secret', async () => {
      const token = await signTestToken(
        { sub: DEFAULT_USER_ID, email: TEST_USER.email },
        { secret: randomUUID() + randomUUID() },
      );
      await request(server)
        .get('/auth/me')
        .auth(token, { type: 'bearer' })
        .expect(401);
    });

    it('rejects a token whose User does not exist', async () => {
      const token = await signTestToken({
        sub: randomUUID(),
        email: 'ghost@example.com',
      });
      await request(server)
        .get('/auth/me')
        .auth(token, { type: 'bearer' })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('clears the cookie for the SPA', async () => {
      const cookie = cookiePair(
        accessTokenCookie(await login(CREDENTIALS).expect(200)),
      );
      const res = await request(server)
        .post('/auth/logout')
        .set('Cookie', cookie)
        .set(XHR)
        .expect(204);
      const cleared = accessTokenCookie(res);
      expect(cookiePair(cleared)).toBe('access_token=');
      expect(cookieAttributes(cleared)).toEqual(
        expect.arrayContaining([
          'Path=/',
          'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
          'HttpOnly',
          'SameSite=Strict',
        ]),
      );
    });

    it('requires authentication', async () => {
      const cookie = cookiePair(
        accessTokenCookie(await login(CREDENTIALS).expect(200)),
      );
      await request(server)
        .post('/auth/logout')
        .set('Cookie', cookie)
        .expect(401);
    });

    it('accepts a Bearer token', async () => {
      const token = await loginAs(server);
      await request(server)
        .post('/auth/logout')
        .auth(token, { type: 'bearer' })
        .expect(204);
    });
  });

  describe('login throttle', () => {
    it('blocks the 6th attempt from one client IP, but not other clients', async () => {
      const ip = nextClientIp();
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await request(server)
          .post('/auth/login')
          .set('X-Forwarded-For', ip)
          .send({ email: TEST_USER.email, password: 'wrong-password' })
          .expect(401);
      }
      const blocked = await request(server)
        .post('/auth/login')
        .set('X-Forwarded-For', ip)
        .send(CREDENTIALS)
        .expect(429);
      expect(blocked.body).toEqual({
        statusCode: 429,
        message: 'Too many login attempts, please try again later',
        error: 'Too Many Requests',
      });
      await login(CREDENTIALS).expect(200);
    });
  });
});
