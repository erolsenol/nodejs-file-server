import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FileStorage } from '@file-server/core';

export class LocalFileStorage implements FileStorage {
  private readonly root: string;

  public constructor(root: string) {
    this.root = resolve(root);
  }

  private pathFor(key: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) throw new Error('Invalid storage key');
    return join(this.root, key);
  }

  public async put(input: NodeJS.ReadableStream, key: string): Promise<{ size: number; checksum: string }> {
    const destination = this.pathFor(key);
    const temporary = `${destination}.${process.pid}.tmp`;
    await mkdir(dirname(destination), { recursive: true });
    const hash = createHash('sha256');
    let size = 0;
    input.on('data', (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      hash.update(buffer);
    });
    try {
      await pipeline(input, createWriteStream(temporary, { flags: 'wx' }));
      await import('node:fs/promises').then(({ rename }) => rename(temporary, destination));
      return { size, checksum: `sha256:${hash.digest('hex')}` };
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }

  public get(key: string): Promise<NodeJS.ReadableStream> {
    return Promise.resolve(createReadStream(this.pathFor(key)));
  }

  public async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  public async exists(key: string): Promise<boolean> {
    const path = this.pathFor(key);
    try { await access(path); return true; } catch { return false; }
  }

  public async check(): Promise<void> {
    await mkdir(this.root, { recursive: true });
  }
}
