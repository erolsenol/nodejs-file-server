import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { JsonFileRepository } from './index.js';

const directories: string[] = [];
const record = { id: 'file-1', ownerId: 'default', name: 'hello.txt', mimeType: 'text/plain', size: 5, checksum: 'sha256:test', createdAt: '2026-01-01T00:00:00.000Z' } as const;

afterEach(async () => Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

describe('JsonFileRepository', () => {
  it('persists and reloads records using atomic replacement', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'file-repository-'));
    directories.push(directory);
    const file = join(directory, 'files.json');
    const repository = new JsonFileRepository(file);
    await repository.create(record);
    const reloaded = new JsonFileRepository(file);
    await reloaded.load();
    expect(await reloaded.findById(record.id)).toEqual(record);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual([record]);
  });

  it('fails closed when persisted data is malformed', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'file-repository-'));
    directories.push(directory);
    const file = join(directory, 'files.json');
    await writeFile(file, '{"unexpected":true}');
    await expect(new JsonFileRepository(file).load()).rejects.toThrow('Repository data must be an array');
  });
});
