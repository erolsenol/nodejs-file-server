import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
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

describe('concurrent atomic uploads', () => {
  it('isolates temporary files for simultaneous writes to the same key', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'file-server-concurrent-')); directories.push(directory);
    const storage = new LocalFileStorage(directory);
    const streams = [Readable.from(['first']), Readable.from(['second'])];
    const results = await Promise.all(streams.map((stream) => storage.put(stream, 'same-key')));
    expect(results.map((result) => result.size)).toEqual([5, 6]);
    expect(['first', 'second']).toContain(await readFile(join(directory, 'same-key'), 'utf8'));
    expect(await readdir(directory)).toEqual(['same-key']);
    expect(streams.map((stream) => stream.listenerCount('data'))).toEqual([0, 0]);
  });
  it('preserves the existing file and removes only its own temporary file after a failed stream', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'file-server-failed-')); directories.push(directory);
    const storage = new LocalFileStorage(directory);
    await storage.put(Readable.from(['original']), 'same-key');
    const failed = Readable.from((async function* () { yield 'partial'; throw new Error('Input failed'); })());
    await expect(storage.put(failed, 'same-key')).rejects.toThrow('Input failed');
    expect(await readFile(join(directory, 'same-key'), 'utf8')).toBe('original');
    expect(await readdir(directory)).toEqual(['same-key']);
    expect(failed.listenerCount('data')).toBe(0);
  });
});
