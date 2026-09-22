import type { FileRecord, FileRepository, FileStorage } from '@file-server/core';

export interface RetentionOptions {
  readonly maxAgeMs: number;
  readonly batchSize?: number;
  readonly now?: () => Date;
  readonly onError?: (record: FileRecord, error: unknown) => void;
}

export interface RetentionResult {
  readonly scanned: number;
  readonly deleted: number;
  readonly failed: number;
}

const DEFAULT_BATCH_SIZE = 100;

export async function runRetention(repository: FileRepository, storage: FileStorage, options: RetentionOptions): Promise<RetentionResult> {
  if (!Number.isFinite(options.maxAgeMs) || options.maxAgeMs <= 0) return { scanned: 0, deleted: 0, failed: 0 };
  const batchSize = Number.isSafeInteger(options.batchSize) && (options.batchSize ?? 0) > 0 ? options.batchSize! : DEFAULT_BATCH_SIZE;
  const cutoff = (options.now ?? (() => new Date()))().getTime() - options.maxAgeMs;
  const expired: FileRecord[] = [];
  let offset = 0;
  let scanned = 0;

  while (true) {
    const batch = await repository.list(batchSize, offset);
    scanned += batch.length;
    expired.push(...batch.filter((record) => {
      const createdAt = Date.parse(record.createdAt);
      return Number.isFinite(createdAt) && createdAt < cutoff;
    }));
    if (batch.length < batchSize) break;
    offset += batch.length;
  }

  let deleted = 0;
  let failed = 0;
  for (const record of expired) {
    try {
      await storage.delete(record.id);
      await repository.delete(record.id, record.ownerId);
      deleted += 1;
    } catch (error) {
      failed += 1;
      options.onError?.(record, error);
    }
  }
  return { scanned, deleted, failed };
}
