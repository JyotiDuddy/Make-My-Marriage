import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const express = require('express');
const request = require('supertest');
const app = require('../src/app.js');
const errorHandler = require('../src/middleware/error-handler.js');
const notFound = require('../src/middleware/not-found.js');
const ApiError = require('../src/shared/errors/api-error.js');

const originalNodeEnv = process.env.NODE_ENV;

function createErrorTestApp() {
  const testApp = express();

  testApp.get('/operational-error', () => {
    throw new ApiError(403, 'FORBIDDEN', 'You are not authorized to perform this action.');
  });
  testApp.get('/unexpected-error', async () => {
    throw new Error('Private database diagnostic.');
  });
  testApp.use(notFound);
  testApp.use(errorHandler);

  return testApp;
}

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

describe('backend foundation HTTP behavior', () => {
  it('returns the documented success envelope from the versioned health route', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Health check passed.',
      data: { status: 'ok' },
    });
  });

  it('returns the documented error envelope and 404 for an unknown route', async () => {
    const response = await request(app).get('/api/v1/unknown');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: 'The requested resource was not found.',
      error: { code: 'NOT_FOUND' },
    });
  });

  it('maps malformed JSON to a 400 validation error', async () => {
    const response = await request(app)
      .post('/api/v1/unknown')
      .set('Content-Type', 'application/json')
      .send('{bad json');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: 'The request body contains invalid JSON.',
      error: { code: 'VALIDATION_ERROR' },
    });
  });

  it('preserves status and code for expected operational errors', async () => {
    const response = await request(createErrorTestApp()).get('/operational-error');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: 'You are not authorized to perform this action.',
      error: { code: 'FORBIDDEN' },
    });
  });

  it('forwards async route failures and returns a useful development message', async () => {
    process.env.NODE_ENV = 'development';

    const response = await request(createErrorTestApp()).get('/unexpected-error');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: 'Private database diagnostic.',
      error: { code: 'INTERNAL_SERVER_ERROR' },
    });
  });

  it('does not expose unexpected error details in production', async () => {
    process.env.NODE_ENV = 'production';

    const response = await request(createErrorTestApp()).get('/unexpected-error');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: 'Internal server error.',
      error: { code: 'INTERNAL_SERVER_ERROR' },
    });
    expect(JSON.stringify(response.body)).not.toContain('Private database diagnostic.');
  });
});
