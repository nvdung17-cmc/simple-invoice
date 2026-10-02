import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { isUUID } from 'class-validator';
import { Strategy } from 'passport-jwt';
import type { EnvironmentVariables } from '../config/env.validation.js';
import type { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { extractJwt } from './jwt-extractor.js';
import type { JwtPayload } from './jwt-payload.js';

/**
 * Verifies the access token (HS256 only, expiry enforced) and loads its User,
 * so the token of a User that no longer exists is rejected at once.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: extractJwt,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
      algorithms: ['HS256'],
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    // A non-UUID `sub` would make PostgreSQL reject the query with a 500.
    const user = isUUID(payload.sub)
      ? await this.users.findById(payload.sub)
      : null;
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
