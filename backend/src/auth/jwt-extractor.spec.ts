import type { Request } from 'express';
import { extractJwt } from './jwt-extractor.js';

function requestWith(
  headers: Record<string, string>,
  cookies: Record<string, string> = {},
): Request {
  return { headers, cookies } as unknown as Request;
}

describe('extractJwt', () => {
  it('reads a Bearer token from the Authorization header', () => {
    expect(
      extractJwt(requestWith({ authorization: 'Bearer header-token' })),
    ).toBe('header-token');
  });

  it('ignores the cookie when X-Requested-With is missing', () => {
    expect(
      extractJwt(requestWith({}, { access_token: 'cookie-token' })),
    ).toBeNull();
  });

  it('reads the cookie when X-Requested-With is XMLHttpRequest', () => {
    expect(
      extractJwt(
        requestWith(
          { 'x-requested-with': 'XMLHttpRequest' },
          { access_token: 'cookie-token' },
        ),
      ),
    ).toBe('cookie-token');
  });

  it('prefers the Bearer header over the cookie', () => {
    expect(
      extractJwt(
        requestWith(
          {
            authorization: 'Bearer header-token',
            'x-requested-with': 'XMLHttpRequest',
          },
          { access_token: 'cookie-token' },
        ),
      ),
    ).toBe('header-token');
  });

  it('returns null when the request has no token', () => {
    expect(extractJwt(requestWith({}))).toBeNull();
  });
});
