import { Readable } from 'node:stream';
import type { FileRecord, FileRepository, FileStorage } from '@file-server/core';
import { describe, expect, it } from 'vitest';
import { createApp } from './index.js';
import { createMetrics } from './metrics.js';

const record: FileRecord = {
  id: 'file-1', ownerId: 'default', name: 'hello.txt', mimeType: 'text/plain', size: 11,
  checksum: 'sha256:test', createdAt: '2026-01-01T00:00:00.000Z',
};

function createTestApp(quotaBytesPerPrincipal?: number) {
  let deleted = false;
  const storage: FileStorage = {
    put: async () => ({ size: record.size, checksum: record.checksum }),
    get: async (_key, range) => Readable.from([range ? 'hello'.slice(range.start, range.end + 1) : 'hello world']),
    delete: async () => { deleted = true; },
    exists: async () => true,
    check: async () => undefined,
  };
  const repository: FileRepository = {
    create: async () => undefined,
    list: async () => [record],
    findById: async () => record,
    delete: async () => undefined,
    totalSize: async () => 10,
  };
  const app = createApp({ apiKey: 'test-api-key-123456', maxFileSize: 1024, allowedMimeTypes: new Set(['text/plain']), storage, repository, metrics: createMetrics(), ...(quotaBytesPerPrincipal === undefined ? {} : { quotaBytesPerPrincipal }) });
  return { app, wasDeleted: () => deleted };
}

describe('Fastify HTTP adapter', () => {
  it('protects file routes with the API key', async () => {
    const { app } = createTestApp();
    const response = await app.inject({ method: 'GET', url: '/v1/files' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('serves a valid byte range', async () => {
    const { app } = createTestApp();
    const response = await app.inject({ method: 'GET', url: '/v1/files/file-1/content', headers: { 'x-api-key': 'test-api-key-123456', range: 'bytes=0-4' } });
    expect(response.statusCode).toBe(206);
    expect(response.headers['content-range']).toBe('bytes 0-4/11');
    expect(response.body).toBe('hello');
    await app.close();
  });

  it('rejects an unsatisfiable byte range', async () => {
    const { app } = createTestApp();
    const response = await app.inject({ method: 'GET', url: '/v1/files/file-1/content', headers: { 'x-api-key': 'test-api-key-123456', range: 'bytes=99-100' } });
    expect(response.statusCode).toBe(416);
    expect(response.headers['content-range']).toBe('bytes */11');
    await app.close();
  });

  it('exposes authenticated Prometheus metrics', async () => {
    const { app } = createTestApp();
    const response = await app.inject({ method: 'GET', url: '/metrics', headers: { 'x-api-key': 'test-api-key-123456' } });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('fileserver_http_requests_total');
    await app.close();
  });

  it('rejects an upload that exceeds the principal storage quota and cleans up the object', async () => {
    const { app, wasDeleted } = createTestApp(14);
    const boundary = 'file-server-test';
    const payload = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="hello.txt"\r\nContent-Type: text/plain\r\n\r\nhello world\r\n--${boundary}--\r\n`;
    const response = await app.inject({
      method: 'POST',
      url: '/v1/files',
      headers: { 'x-api-key': 'test-api-key-123456', 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    });
    expect(response.statusCode).toBe(413);
    expect(response.json()).toMatchObject({ error: { code: 'LIMIT_EXCEEDED', message: 'Storage quota exceeded' } });
    expect(wasDeleted()).toBe(true);
    await app.close();
  });
});
