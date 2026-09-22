import { Readable } from 'node:stream';
import type { FileRecord, FileRepository, FileStorage } from '@file-server/core';
import { describe, expect, it } from 'vitest';
import { createApp } from './index.js';

const record: FileRecord = {
  id: 'file-1', name: 'hello.txt', mimeType: 'text/plain', size: 11,
  checksum: 'sha256:test', createdAt: '2026-01-01T00:00:00.000Z',
};

function createTestApp() {
  const storage: FileStorage = {
    put: async () => ({ size: record.size, checksum: record.checksum }),
    get: async (_key, range) => Readable.from([range ? 'hello'.slice(range.start, range.end + 1) : 'hello world']),
    delete: async () => undefined,
    exists: async () => true,
    check: async () => undefined,
  };
  const repository: FileRepository = {
    create: async () => undefined,
    list: async () => [record],
    findById: async () => record,
    delete: async () => undefined,
  };
  return createApp({ apiKey: 'test-api-key-123456', maxFileSize: 1024, allowedMimeTypes: new Set(['text/plain']), storage, repository });
}

describe('Fastify HTTP adapter', () => {
  it('protects file routes with the API key', async () => {
    const app = createTestApp();
    const response = await app.inject({ method: 'GET', url: '/v1/files' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('serves a valid byte range', async () => {
    const app = createTestApp();
    const response = await app.inject({ method: 'GET', url: '/v1/files/file-1/content', headers: { 'x-api-key': 'test-api-key-123456', range: 'bytes=0-4' } });
    expect(response.statusCode).toBe(206);
    expect(response.headers['content-range']).toBe('bytes 0-4/11');
    expect(response.body).toBe('hello');
    await app.close();
  });

  it('rejects an unsatisfiable byte range', async () => {
    const app = createTestApp();
    const response = await app.inject({ method: 'GET', url: '/v1/files/file-1/content', headers: { 'x-api-key': 'test-api-key-123456', range: 'bytes=99-100' } });
    expect(response.statusCode).toBe(416);
    expect(response.headers['content-range']).toBe('bytes */11');
    await app.close();
  });
});
