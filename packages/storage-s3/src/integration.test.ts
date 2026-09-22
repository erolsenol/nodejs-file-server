import { Readable } from 'node:stream';
import { CreateBucketCommand, DeleteBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';
import { S3FileStorage } from './index.js';

const enabled = process.env.S3_INTEGRATION === '1';
const endpoint = process.env.S3_ENDPOINT ?? 'http://127.0.0.1:9000';
const accessKeyId = process.env.S3_ACCESS_KEY_ID ?? 'minioadmin';
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? 'minioadmin';
const bucket = process.env.S3_BUCKET ?? `files-integration-${process.env.GITHUB_RUN_ID ?? Date.now()}`.toLowerCase().slice(0, 63);

(enabled ? describe : describe.skip)('S3FileStorage MinIO integration', () => {
  it('performs the complete object lifecycle against an S3-compatible API', async () => {
    const client = new S3Client({ region: 'us-east-1', endpoint, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } });
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    const storage = new S3FileStorage({ bucket, client });
    const key = 'integration-file';
    try {
      await storage.check();
      await expect(storage.put(Readable.from(['hello world']), key)).resolves.toMatchObject({ size: 11, checksum: expect.stringMatching(/^sha256:/) });
      expect(await storage.exists(key)).toBe(true);
      const chunks: Buffer[] = [];
      for await (const chunk of await storage.get(key, { start: 0, end: 4 })) chunks.push(Buffer.from(chunk));
      expect(Buffer.concat(chunks).toString()).toBe('hello');
      await storage.delete(key);
      expect(await storage.exists(key)).toBe(false);
    } finally {
      await client.send(new DeleteBucketCommand({ Bucket: bucket }));
      client.destroy();
    }
  });
});
