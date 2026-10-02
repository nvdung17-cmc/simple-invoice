import type { Request } from 'express';
import { ExtractJwt, type JwtFromRequestFunction } from 'passport-jwt';
import { ACCESS_TOKEN_COOKIE } from './auth-cookie.js';

/**
 * Reads the token from the httpOnly cookie, but only on requests that carry
 * `X-Requested-With: XMLHttpRequest`. A cross-site form or link cannot set that
 * header, so the cookie alone never authenticates a request (ADR-0002).
 */
export const fromSpaCookie: JwtFromRequestFunction<Request> = (request) => {
  if (request.headers['x-requested-with'] !== 'XMLHttpRequest') return null;
  const token: unknown = request.cookies?.[ACCESS_TOKEN_COOKIE];
  return typeof token === 'string' && token !== '' ? token : null;
};

/** The Bearer header first (Swagger, curl), then the SPA cookie. */
export const extractJwt: JwtFromRequestFunction<Request> =
  ExtractJwt.fromExtractors([
    ExtractJwt.fromAuthHeaderAsBearerToken(),
    fromSpaCookie,
  ]);
