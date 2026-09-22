import { createHash } from 'node:crypto';
import { PassThrough, Transform, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { HeadBucketCommand, GetObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import type { FileStorage } from '@file-server/core';

export interface S3StorageOptions {
  readonly bucket: string;
  readonly client: S3Client;
}

export class S3FileStorage implements FileStorage {
  private readonly bucket: string;
  private readonly client: S3Client;

  public constructor(options: S3StorageOptions) {
    this.bucket = options.bucket;
    this.client = options.client;
  }

  public async put(input: NodeJS.ReadableStream, key: string): Promise<{ size: number; checksum: string }> {
    const passThrough = new PassThrough();
    const hash = createHash('sha256');
    let size = 0;
    const measured = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        size += chunk.length;
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    const upload = new Upload({ client: this.client, params: { Bucket: this.bucket, Key: key, Body: passThrough }, partSize: 8 * 1024 * 1024, queueSize: 2 });
    await Promise.all([pipeline(input, measured, passThrough), upload.done()]);
    return { size, checksum: `sha256:${hash.digest('hex')}` };
  }

  public async get(key: string, range?: { readonly start: number; readonly end: number }): Promise<NodeJS.ReadableStream> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: range ? `bytes=${range.start}-${range.end}` : undefined }));
    if (!response.Body) throw new Error('S3 returned an empty response body');
    if (response.Body instanceof Readable) return response.Body;
    return Readable.fromWeb(response.Body.transformToWebStream() as import('node:stream/web').ReadableStream);
  }

  public async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  public async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: 'bytes=0-0' }));
      return true;
    } catch (error) {
      if ((error as { name?: string }).name === 'NoSuchKey' || (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return false;
      throw error;
    }
  }

  public async check(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }
}

export function createS3Storage(options: { bucket: string; region: string; endpoint: string | undefined; forcePathStyle: boolean | undefined; accessKeyId: string | undefined; secretAccessKey: string | undefined }): S3FileStorage {
  const credentials = options.accessKeyId && options.secretAccessKey ? { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey } : undefined;
  const clientOptions = { region: options.region, ...(options.endpoint ? { endpoint: options.endpoint } : {}), ...(options.forcePathStyle ? { forcePathStyle: true } : {}), ...(credentials ? { credentials } : {}) };
  return new S3FileStorage({ bucket: options.bucket, client: new S3Client(clientOptions) });
}
