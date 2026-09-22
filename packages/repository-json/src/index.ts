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
      this.records = new Map((data as FileRecord[]).map((record) => [record.id, record]));
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

  public async list(limit: number, offset: number): Promise<readonly FileRecord[]> {
    return [...this.records.values()].slice(offset, offset + limit);
  }

  public async findById(id: string): Promise<FileRecord | null> {
    return this.records.get(id) ?? null;
  }

  public async delete(id: string): Promise<void> {
    this.records.delete(id);
    await this.persist();
  }
}
