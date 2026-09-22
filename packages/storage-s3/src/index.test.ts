import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { S3FileStorage } from './index.js';

describe('S3FileStorage', () => {
  it('uploads content with measured size and checksum', async () => {
    const calls: string[] = [];
    const storage = new S3FileStorage({
      bucket: 'files',
      client: {} as never,
      upload: async ({ bucket, key, body }) => {
        calls.push(`${bucket}:${key}`);
        for await (const chunk of body) { void chunk; }
      },
    });
    await expect(storage.put(Readable.from(['hello']), 'file-1')).resolves.toEqual({ size: 5, checksum: 'sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824' });
    expect(calls).toEqual(['files:file-1']);
  });

  it('reads ranged content through the S3 command adapter', async () => {
    const calls: unknown[] = [];
    const client = { send: async (command: { input: unknown }) => { calls.push(command.input); return { Body: Readable.from(['hello']) }; } };
    const storage = new S3FileStorage({ bucket: 'files', client: client as never });
    const chunks: Buffer[] = [];
    for await (const chunk of await storage.get('file-1', { start: 0, end: 4 })) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe('hello');
    expect(calls).toEqual([{ Bucket: 'files', Key: 'file-1', Range: 'bytes=0-4' }]);
  });

  it('returns false for a missing object without hiding provider failures', async () => {
    const client = { send: async () => { throw Object.assign(new Error('missing'), { name: 'NoSuchKey' }); } };
    const storage = new S3FileStorage({ bucket: 'files', client: client as never });
    await expect(storage.exists('missing')).resolves.toBe(false);
  });

  it('supports readiness and idempotent delete commands', async () => {
    const calls: unknown[] = [];
    const client = { send: async (command: { input: unknown }) => { calls.push(command.input); return {}; } };
    const storage = new S3FileStorage({ bucket: 'files', client: client as never });
    await storage.check();
    await storage.delete('file-1');
    expect(calls).toEqual([{ Bucket: 'files' }, { Bucket: 'files', Key: 'file-1' }]);
  });
});
