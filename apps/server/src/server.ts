import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createApp, parseLimit } from '@file-server/http-fastify';
import type { FileRecord, FileRepository } from '@file-server/core';
import { LocalFileStorage } from '@file-server/storage-local';

class JsonFileRepository implements FileRepository {
  private records = new Map<string, FileRecord>();
  public constructor(private readonly file: string) {}
  private async persist(): Promise<void> { await mkdir(dirname(this.file), { recursive: true }); await writeFile(this.file, JSON.stringify([...this.records.values()], null, 2)); }
  public async load(): Promise<void> { try { const data = JSON.parse(await readFile(this.file, 'utf8')) as FileRecord[]; this.records = new Map(data.map((record) => [record.id, record])); } catch { /* first boot */ } }
  public async create(record: FileRecord): Promise<void> { this.records.set(record.id, record); await this.persist(); }
  public async list(limit: number, offset: number): Promise<readonly FileRecord[]> { return [...this.records.values()].slice(offset, offset + limit); }
  public async findById(id: string): Promise<FileRecord | null> { return this.records.get(id) ?? null; }
  public async delete(id: string): Promise<void> { this.records.delete(id); await this.persist(); }
}

const port = Number(process.env.PORT ?? 3000);
const dataDir = process.env.DATA_DIR ?? '.data';
const repository = new JsonFileRepository(join(dataDir, 'files.json'));
await repository.load();
const storage = new LocalFileStorage(join(dataDir, 'objects'));
const app = createApp({
  apiKey: process.env.API_KEY ?? 'change-me-in-production',
  maxFileSize: parseLimit(process.env.MAX_FILE_SIZE_BYTES),
  allowedMimeTypes: new Set((process.env.ALLOWED_MIME_TYPES ?? 'application/octet-stream').split(',').map((value) => value.trim())),
  storage,
  repository,
});
await app.listen({ host: process.env.HOST ?? '0.0.0.0', port });
