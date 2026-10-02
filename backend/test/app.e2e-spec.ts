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
});
