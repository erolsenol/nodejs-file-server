import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalFileStorage } from './index.js';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('LocalFileStorage', () => {
  it('writes atomically, calculates checksum, and reads the same bytes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'file-server-'));
    directories.push(directory);
    const storage = new LocalFileStorage(directory);
    const result = await storage.put(Readable.from(['hello']), 'file-1');

    expect(result.size).toBe(5);
    expect(result.checksum).toBe('sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    expect(await readFile(join(directory, 'file-1'), 'utf8')).toBe('hello');
    expect(await storage.exists('file-1')).toBe(true);
  });

  it('rejects unsafe storage keys', async () => {
    const storage = new LocalFileStorage('/tmp/file-server-test');
    await expect(storage.exists('../escape')).rejects.toThrow('Invalid storage key');
  });
});
