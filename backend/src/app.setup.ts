import { type NestApplicationOptions, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import {
  type EnvironmentVariables,
  parseTrustProxy,
} from './config/env.validation.js';

/**
 * Creation options. Nest's default body parsers are off, so the only parser is
 * the JSON one registered below: form-encoded and text bodies are never parsed.
 */
export const appOptions: NestApplicationOptions = { bodyParser: false };

/**
 * The HTTP pipeline, shared by main.ts and the e2e tests so both run exactly
 * the same middleware, validation, error handling and Swagger setup.
 */
export function applyAppSetup(app: NestExpressApplication): void {
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  // Behind nginx, req.ip must be the real client (login throttle) and
  // req.secure must reflect TLS (the cookie's Secure flag).
  app.set(
    'trust proxy',
    parseTrustProxy(config.get('TRUST_PROXY', { infer: true })),
  );
  app.use(
    helmet({
      // Keep helmet's CSP but drop upgrade-insecure-requests, so Swagger UI's
      // assets still load over plain http://localhost.
      contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } },
    }),
  );
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '100kb' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));

  const documentConfig = new DocumentBuilder()
    .setTitle('SimpleInvoice API')
    .setDescription(
      'REST API of SimpleInvoice. Call POST /auth/login, then click "Authorize" ' +
        'and paste the accessToken (Bearer scheme). The SPA uses the httpOnly ' +
        '`access_token` cookie set by the same call instead; the API accepts that ' +
        'cookie only together with the header `X-Requested-With: XMLHttpRequest`.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('auth', 'Sign in, current User and sign out')
    .addTag('invoices', 'List, view and create Invoices')
    .addTag('health', 'Liveness and database readiness')
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    () => SwaggerModule.createDocument(app, documentConfig),
    {
      jsonDocumentUrl: 'api/docs-json',
      swaggerOptions: { persistAuthorization: true },
    },
  );
}
