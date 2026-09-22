import { Readable } from 'node:stream';
import type { FileRecord, FileRepository, FileStorage } from '@file-server/core';
import { describe, expect, it, vi } from 'vitest';
import { runRetention } from './index.js';

const oldRecord: FileRecord = { id: 'old', ownerId: 'tenant-a', name: 'old.txt', mimeType: 'text/plain', size: 1, checksum: 'old', createdAt: '2026-01-01T00:00:00.000Z' };
const newRecord: FileRecord = { ...oldRecord, id: 'new', name: 'new.txt', createdAt: '2026-09-20T00:00:00.000Z' };
const storage: FileStorage = { put: async () => ({ size: 0, checksum: '' }), get: async () => Readable.from([]), delete: vi.fn(async () => undefined), exists: async () => true, check: async () => undefined };

describe('runRetention', () => {
  it('deletes expired objects before their metadata', async () => {
    const deleted: string[] = [];
    const repository: FileRepository = { list: async () => [oldRecord, newRecord], create: async () => undefined, findById: async () => null, delete: async (id) => { deleted.push(id); } };
    const order: string[] = [];
    const retentionStorage: FileStorage = { ...storage, delete: async (id) => { order.push(`storage:${id}`); } };
    const result = await runRetention(repository, retentionStorage, { maxAgeMs: 30 * 24 * 60 * 60 * 1000, now: () => new Date('2026-09-22T00:00:00.000Z') });
    expect(result).toEqual({ scanned: 2, deleted: 1, failed: 0 });
    expect(order).toEqual(['storage:old']);
    expect(deleted).toEqual(['old']);
  });

  it('continues after a failed cleanup and reports the failure', async () => {
    const onError = vi.fn();
    const repository: FileRepository = { list: async () => [oldRecord], create: async () => undefined, findById: async () => null, delete: async () => undefined };
    const failingStorage: FileStorage = { ...storage, delete: async () => { throw new Error('storage unavailable'); } };
    await expect(runRetention(repository, failingStorage, { maxAgeMs: 1, now: () => new Date('2026-09-22T00:00:00.000Z'), onError })).resolves.toEqual({ scanned: 1, deleted: 0, failed: 1 });
    expect(onError).toHaveBeenCalledWith(oldRecord, expect.any(Error));
  });
});
