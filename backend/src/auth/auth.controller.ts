import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/current-user.decorator.js';
import { ErrorResponseDto } from '../common/error-response.dto.js';
import { Public } from '../common/public.decorator.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { User } from '../users/user.entity.js';
import { ACCESS_TOKEN_COOKIE, authCookieOptions } from './auth-cookie.js';
import { AuthService } from './auth.service.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { toUserDto, UserDto } from './dto/user.dto.js';

/** Sign in, the current User and sign out (spec §5.3, §5.4, ADR-0002). */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in with email and password',
    description:
      'Returns an access token for the Authorization header and sets the same token as the httpOnly `access_token` cookie. ' +
      'Each client IP gets LOGIN_THROTTLE_LIMIT attempts per LOGIN_THROTTLE_TTL seconds.',
  })
  @ApiOkResponse({
    type: LoginResponseDto,
    headers: {
      'Set-Cookie': {
        description:
          '`access_token=<JWT>; Max-Age=<expiresIn>; Path=/; HttpOnly; SameSite=Strict`, plus `Secure` over HTTPS',
        schema: { type: 'string' },
      },
    },
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'The body is not valid',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Invalid email or password',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Too many login attempts from this client',
  })
  async login(
    @Body() credentials: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.auth.login(credentials);
    response.cookie(ACCESS_TOKEN_COOKIE, result.accessToken, {
      ...authCookieOptions(request, this.cookieSecureMode()),
      maxAge: result.expiresIn * 1000,
    });
    return result;
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get the signed-in User',
    description: 'The SPA calls this at start-up to restore the session.',
  })
  @ApiOkResponse({ type: UserDto })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'The token is missing, invalid or expired',
  })
  me(@CurrentUser() user: User): UserDto {
    return toUserDto(user);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Sign out',
    description:
      'Clears the `access_token` cookie. A Bearer token stays valid until it expires (the tokens are stateless).',
  })
  @ApiNoContentResponse({ description: 'Signed out; the cookie is cleared' })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'The token is missing, invalid or expired',
  })
  logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): void {
    response.clearCookie(
      ACCESS_TOKEN_COOKIE,
      authCookieOptions(request, this.cookieSecureMode()),
    );
  }

  private cookieSecureMode() {
    return this.config.get('COOKIE_SECURE', { infer: true });
  }
}
