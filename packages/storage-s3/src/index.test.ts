import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { S3FileStorage } from './index.js';

describe('S3FileStorage', () => {
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
});
