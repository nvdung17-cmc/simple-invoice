import type { CookieOptions, Request } from 'express';
import type { CookieSecureMode } from '../config/env.validation.js';

/** Name of the httpOnly cookie that carries the SPA's access token (ADR-0002). */
export const ACCESS_TOKEN_COOKIE = 'access_token';

/**
 * Flags of the access-token cookie (spec §5.4). `Secure` follows COOKIE_SECURE;
 * `auto` sets it when the request came over HTTPS, directly or through a
 * trusted proxy (X-Forwarded-Proto).
 */
export function authCookieOptions(
  request: Request,
  mode: CookieSecureMode,
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: mode === 'auto' ? request.secure : mode === 'true',
  };
}
