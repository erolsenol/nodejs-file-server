import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteFileRepository } from './index.js';

const directories: string[] = [];
const record = { id: 'file-1', ownerId: 'default', name: 'hello.txt', mimeType: 'text/plain', size: 5, checksum: 'sha256:test', createdAt: '2026-01-01T00:00:00.000Z' } as const;

afterEach(async () => Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

describe('SqliteFileRepository', () => {
  it('persists records and maps database fields to the domain contract', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'file-sqlite-'));
    directories.push(directory);
    const repository = new SqliteFileRepository(join(directory, 'metadata.db'));
    await repository.create(record);
    expect(await repository.findById(record.id)).toEqual(record);
    expect(await repository.list(10, 0)).toEqual([record]);
    expect(await repository.totalSize(record.ownerId)).toBe(record.size);
    repository.close();
  });

  it('deletes records', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'file-sqlite-'));
    directories.push(directory);
    const repository = new SqliteFileRepository(join(directory, 'metadata.db'));
    await repository.create(record);
    await repository.delete(record.id);
    expect(await repository.findById(record.id)).toBeNull();
    repository.close();
  });
});
