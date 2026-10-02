import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  startTestApp,
  stopTestApp,
  type TestContext,
} from './utils/test-app.js';

describe('HTTP foundation (e2e)', () => {
  let context: TestContext;
  let server: App;

  beforeAll(async () => {
    context = await startTestApp();
    server = context.app.getHttpServer();
  });

  afterAll(async () => {
    await stopTestApp(context);
  });

  it('GET /health reports the database as up', async () => {
    const res = await request(server).get('/health').expect(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      info: { database: { status: 'up' } },
    });
  });

  it('answers unknown routes with the standard error shape', async () => {
    const res = await request(server).get('/nope').expect(404);
    expect(res.body).toEqual({
      statusCode: 404,
      message: 'Cannot GET /nope',
      error: 'Not Found',
    });
  });

  it('sets helmet security headers and hides Express', async () => {
    const res = await request(server).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['content-security-policy']).toContain(
      "default-src 'self'",
    );
    expect(res.headers['content-security-policy']).not.toContain(
      'upgrade-insecure-requests',
    );
  });

  it('serves Swagger UI at /api/docs and the OpenAPI document at /api/docs-json', async () => {
    const ui = await request(server).get('/api/docs').expect(200);
    expect(ui.headers['content-type']).toContain('text/html');
    const doc = await request(server).get('/api/docs-json').expect(200);
    expect(doc.body.info).toMatchObject({
      title: 'SimpleInvoice API',
      version: '1.0.0',
    });
  });

  it('rejects a JSON body over 100 kB with 413', async () => {
    const res = await request(server)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ padding: 'x'.repeat(200_000) }))
      .expect(413);
    expect(res.body).toEqual({
      statusCode: 413,
      message: 'request entity too large',
      error: 'Payload Too Large',
    });
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(server)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":')
      .expect(400);
    expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
  });

  it('documents every endpoint, with Bearer as the only security scheme', async () => {
    interface Operation {
      summary?: string;
      tags?: string[];
      security?: unknown;
      responses: Record<string, { description?: string }>;
    }
    const doc = (await request(server).get('/api/docs-json').expect(200))
      .body as {
      paths: Record<string, Record<string, Operation>>;
      components: {
        securitySchemes: unknown;
        schemas: Record<
          string,
          { properties: Record<string, { description?: string }> }
        >;
      };
    };

    expect(Object.keys(doc.paths).sort()).toEqual([
      '/auth/login',
      '/auth/logout',
      '/auth/me',
      '/health',
      '/invoices',
      '/invoices/{id}',
    ]);
    expect(doc.components.securitySchemes).toEqual({
      bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    });
    for (const [path, operations] of Object.entries(doc.paths)) {
      for (const [method, operation] of Object.entries(operations)) {
        expect(operation.summary, `${method} ${path}`).toBeTruthy();
        expect(operation.tags, `${method} ${path}`).toHaveLength(1);
        for (const [code, response] of Object.entries(operation.responses)) {
          expect(
            response.description,
            `${method} ${path} ${code}`,
          ).toBeTruthy();
        }
      }
    }
    expect(
      doc.components.schemas.ErrorResponseDto.properties.message.description,
    ).toContain('per failed rule');
    // CONTEXT.md avoids this word because it reads as Customer; the Swagger text must too.
    expect(JSON.stringify(doc)).not.toMatch(/\bclient\b/i);

    const createOperation = doc.paths['/invoices'].post;
    expect(Object.keys(createOperation.responses).sort()).toEqual([
      '201',
      '400',
      '401',
      '409',
    ]);
    expect(createOperation.security).toEqual([{ bearer: [] }]);
    expect(
      Object.keys(doc.paths['/invoices/{id}'].get.responses).sort(),
    ).toEqual(['200', '400', '401', '404']);
    expect(Object.keys(doc.paths['/auth/login'].post.responses).sort()).toEqual(
      ['200', '400', '401', '429'],
    );
  });
});
