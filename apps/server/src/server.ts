import 'dotenv/config';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createApp, parseLimit } from '@file-server/http-fastify';
import type { FileRecord, FileRepository } from '@file-server/core';
import { LocalFileStorage } from '@file-server/storage-local';
import { loadConfig } from './config.js';

class JsonFileRepository implements FileRepository {
  private records = new Map<string, FileRecord>();
  private persistQueue: Promise<void> = Promise.resolve();
  public constructor(private readonly file: string) {}
  private persist(): Promise<void> {
    const snapshot = JSON.stringify([...this.records.values()], null, 2);
    this.persistQueue = this.persistQueue.then(async () => {
      await mkdir(dirname(this.file), { recursive: true });
      const temporary = `${this.file}.${process.pid}.tmp`;
      await writeFile(temporary, snapshot, 'utf8');
      await rename(temporary, this.file);
    });
    return this.persistQueue;
  }
  public async load(): Promise<void> {
    try {
      const data = JSON.parse(await readFile(this.file, 'utf8')) as FileRecord[];
      this.records = new Map(data.map((record) => [record.id, record]));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  public async create(record: FileRecord): Promise<void> { this.records.set(record.id, record); await this.persist(); }
  public async list(limit: number, offset: number): Promise<readonly FileRecord[]> { return [...this.records.values()].slice(offset, offset + limit); }
  public async findById(id: string): Promise<FileRecord | null> { return this.records.get(id) ?? null; }
  public async delete(id: string): Promise<void> { this.records.delete(id); await this.persist(); }
}

const config = loadConfig();
const { dataDir } = config;
const repository = new JsonFileRepository(join(dataDir, 'files.json'));
await repository.load();
const storage = new LocalFileStorage(join(dataDir, 'objects'));
const app = createApp({
  apiKey: config.apiKey,
  maxFileSize: parseLimit(String(config.maxFileSizeBytes)),
  allowedMimeTypes: config.allowedMimeTypes,
  rateLimitMax: config.rateLimitMax,
  storage,
  repository,
});
await app.listen({ host: config.host, port: config.port });

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  process.exit(0);
};
process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
