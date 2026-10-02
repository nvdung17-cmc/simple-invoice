import {
  type ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function setup() {
  const reply = vi.fn();
  const adapterHost = { httpAdapter: { reply } } as unknown as HttpAdapterHost;
  const request = { method: 'GET', originalUrl: '/invoices' };
  const response = {};
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  const filter = new AllExceptionsFilter(adapterHost);
  return {
    reply,
    response,
    handle: (exception: unknown) => filter.catch(exception, host),
  };
}

describe('AllExceptionsFilter', () => {
  it('keeps the message of an HttpException and adds the reason phrase', () => {
    const { reply, response, handle } = setup();
    handle(new NotFoundException('Invoice not found'));
    expect(reply).toHaveBeenCalledWith(
      response,
      { statusCode: 404, message: 'Invoice not found', error: 'Not Found' },
      404,
    );
  });

  it('keeps the message array of a validation error', () => {
    const { reply, handle } = setup();
    handle(
      new BadRequestException([
        'dueDate must be on or after invoiceDate',
        'items must contain exactly 1 item',
      ]),
    );
    expect(reply.mock.calls[0][1]).toEqual({
      statusCode: 400,
      message: [
        'dueDate must be on or after invoiceDate',
        'items must contain exactly 1 item',
      ],
      error: 'Bad Request',
    });
  });

  it('wraps a string response, such as the throttler message', () => {
    const { reply, handle } = setup();
    handle(
      new HttpException(
        'Too many login attempts, please try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );
    expect(reply.mock.calls[0][1]).toEqual({
      statusCode: 429,
      message: 'Too many login attempts, please try again later',
      error: 'Too Many Requests',
    });
    expect(reply.mock.calls[0][2]).toBe(429);
  });

  it('passes through bodies without a message, such as the health report', () => {
    const report = {
      status: 'error',
      info: {},
      error: { database: { status: 'down' } },
      details: { database: { status: 'down' } },
    };
    const { reply, handle } = setup();
    handle(new ServiceUnavailableException(report));
    expect(reply.mock.calls[0][1]).toEqual(report);
    expect(reply.mock.calls[0][2]).toBe(503);
  });

  it('exposes 4xx errors raised by Express middleware, such as a body that is too large', () => {
    const { reply, handle } = setup();
    handle(
      Object.assign(new Error('request entity too large'), {
        status: 413,
        expose: true,
      }),
    );
    expect(reply.mock.calls[0][1]).toEqual({
      statusCode: 413,
      message: 'request entity too large',
      error: 'Payload Too Large',
    });
  });

  it('hides unknown errors behind a 500 and logs them with the request', () => {
    const logError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { reply, handle } = setup();
    handle(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    expect(reply.mock.calls[0][1]).toEqual({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
    expect(reply.mock.calls[0][2]).toBe(500);
    expect(logError).toHaveBeenCalledWith(
      'GET /invoices failed',
      expect.stringContaining('ECONNREFUSED'),
    );
  });
});
