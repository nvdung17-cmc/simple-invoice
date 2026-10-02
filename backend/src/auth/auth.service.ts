import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { PasswordHasher } from '../users/password-hasher.js';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { toUserDto } from './dto/user.dto.js';
import type { JwtPayload } from './jwt-payload.js';

/** Checks credentials and issues access tokens. */
@Injectable()
export class AuthService {
  /**
   * A hash of a random password, made once at start-up and compared when the
   * email is unknown, so the first unknown-email login costs the same as every
   * other. Hashing a UUID cannot fail, so this promise never ends in an unhandled
   * rejection.
   */
  private readonly dummyHash: Promise<string>;

  constructor(
    private readonly users: UsersService,
    private readonly hasher: PasswordHasher,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.dummyHash = this.hasher.hash(randomUUID());
  }

  /**
   * Returns an access token for valid credentials. An unknown email costs the
   * same bcrypt comparison as a wrong password, and both get the same 401, so
   * neither the response nor its timing reveals which emails exist.
   */
  async login(credentials: LoginDto): Promise<LoginResponseDto> {
    const user = await this.users.findByEmail(credentials.email);
    const hash = user?.passwordHash ?? (await this.dummyHash);
    const valid = await this.hasher.verify(credentials.password, hash);
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: await this.jwt.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: this.config.get('JWT_EXPIRES_IN', { infer: true }),
      user: toUserDto(user),
    };
  }
}
