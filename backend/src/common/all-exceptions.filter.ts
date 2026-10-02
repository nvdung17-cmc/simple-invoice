import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { STATUS_CODES } from 'node:http';

/**
 * Global exception filter (spec §5.5): every error leaves the API as
 * `{ statusCode, message, error }`. Unknown errors become a 500 that never
 * reveals internals; their stack trace is logged with the request.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<{
      method?: string;
      originalUrl?: string;
    }>();
    const [status, body] = this.toResponse(exception, request);
    this.adapterHost.httpAdapter.reply(context.getResponse(), body, status);
  }

  private toResponse(
    exception: unknown,
    request: { method?: string; originalUrl?: string },
  ): [number, unknown] {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        return [status, errorBody(status, payload)];
      }
      if (hasMessage(payload)) {
        const error =
          typeof payload.error === 'string'
            ? payload.error
            : reasonPhrase(status);
        return [
          status,
          { statusCode: status, message: payload.message, error },
        ];
      }
      // Bodies without a message, such as the Terminus health report, pass through.
      return [status, payload];
    }

    const clientError = exposedClientError(exception);
    if (clientError) {
      return [
        clientError.status,
        errorBody(clientError.status, clientError.message),
      ];
    }

    this.logger.error(
      `${request.method} ${request.originalUrl} failed`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    return [
      HttpStatus.INTERNAL_SERVER_ERROR,
      errorBody(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal server error'),
    ];
  }
}

function reasonPhrase(status: number): string {
  return STATUS_CODES[status] ?? 'Error';
}

function errorBody(status: number, message: string) {
  return { statusCode: status, message, error: reasonPhrase(status) };
}

function hasMessage(
  payload: object,
): payload is { message: string | string[]; error?: unknown } {
  const { message } = payload as { message?: unknown };
  return (
    typeof message === 'string' ||
    (Array.isArray(message) && message.every((m) => typeof m === 'string'))
  );
}

/**
 * Errors from Express middleware (the JSON body parser) carry an HTTP status
 * and an `expose` flag. Exposed 4xx ones are safe to show, e.g. 413
 * "request entity too large".
 */
function exposedClientError(
  exception: unknown,
): { status: number; message: string } | undefined {
  if (!(exception instanceof Error)) return undefined;
  const { status, expose } = exception as Error & {
    status?: unknown;
    expose?: unknown;
  };
  if (
    typeof status === 'number' &&
    status >= 400 &&
    status < 500 &&
    expose === true
  ) {
    return { status, message: exception.message };
  }
  return undefined;
}
