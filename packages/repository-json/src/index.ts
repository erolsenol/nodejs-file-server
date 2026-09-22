import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { FileRecord, FileRepository } from '@file-server/core';

export class JsonFileRepository implements FileRepository {
  private records = new Map<string, FileRecord>();
  private persistQueue: Promise<void> = Promise.resolve();

  public constructor(private readonly file: string) {}

  public async load(): Promise<void> {
    try {
      const data = JSON.parse(await readFile(this.file, 'utf8')) as unknown;
      if (!Array.isArray(data) || data.some((value) => !value || typeof value !== 'object')) throw new Error('Repository data must be an array of records');
      this.records = new Map((data as Array<FileRecord & { ownerId?: string }>).map((record) => [record.id, { ...record, ownerId: record.ownerId ?? 'default' }]));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

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

  public async create(record: FileRecord): Promise<void> {
    this.records.set(record.id, record);
    await this.persist();
  }

  public async list(limit: number, offset: number, ownerId?: string): Promise<readonly FileRecord[]> {
    return [...this.records.values()].filter((record) => !ownerId || record.ownerId === ownerId).slice(offset, offset + limit);
  }

  public async findById(id: string, ownerId?: string): Promise<FileRecord | null> {
    const record = this.records.get(id);
    return record && (!ownerId || record.ownerId === ownerId) ? record : null;
  }

  public async delete(id: string, ownerId?: string): Promise<void> {
    const record = this.records.get(id);
    if (record && (!ownerId || record.ownerId === ownerId)) this.records.delete(id);
    await this.persist();
  }
}
