import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '@file-server/http-fastify';
import { SqliteFileRepository } from '@file-server/repository-sqlite';
import { LocalFileStorage } from '@file-server/storage-local';
import { afterEach, describe, expect, it } from 'vitest';

const directories: string[] = [];
const apiKeys = new Map([['tenant-a', 'tenant-a-secret'], ['tenant-b', 'tenant-b-secret']]);

const multipartPayload = (content: string): { payload: string; contentType: string } => {
  const boundary = 'file-server-smoke';
  return {
    payload: `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="hello.txt"\r\nContent-Type: text/plain\r\n\r\n${content}\r\n--${boundary}--\r\n`,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
};

afterEach(async () => Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

describe('server HTTP smoke flow', () => {
  it('uploads, isolates, ranges, and deletes a real local file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'file-server-smoke-'));
    directories.push(directory);
    const repository = new SqliteFileRepository(join(directory, 'metadata.db'));
    const storage = new LocalFileStorage(join(directory, 'objects'));
    await repository.load();
    const app = createApp({
      apiKey: 'unused-default-key',
      apiKeys,
      maxFileSize: 1024,
      allowedMimeTypes: new Set(['text/plain']),
      storage,
      repository,
    });

    try {
      const form = multipartPayload('hello world');
      const upload = await app.inject({ method: 'POST', url: '/v1/files', headers: { 'x-api-key': 'tenant-a-secret', 'content-type': form.contentType }, payload: form.payload });
      expect(upload.statusCode).toBe(201);
      const fileId = (upload.json() as { id: string }).id;

      const hidden = await app.inject({ method: 'GET', url: `/v1/files/${fileId}`, headers: { 'x-api-key': 'tenant-b-secret' } });
      expect(hidden.statusCode).toBe(404);

      const range = await app.inject({ method: 'GET', url: `/v1/files/${fileId}/content`, headers: { 'x-api-key': 'tenant-a-secret', range: 'bytes=0-4' } });
      expect(range.statusCode).toBe(206);
      expect(range.body).toBe('hello');

      const deletion = await app.inject({ method: 'DELETE', url: `/v1/files/${fileId}`, headers: { 'x-api-key': 'tenant-a-secret' } });
      expect(deletion.statusCode).toBe(204);
      expect(await storage.exists(fileId)).toBe(false);
      expect(await repository.findById(fileId)).toBeNull();
    } finally {
      await app.close();
      await repository.close();
    }
  });
});
