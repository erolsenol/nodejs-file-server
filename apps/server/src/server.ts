import 'dotenv/config';
import { join } from 'node:path';
import { createApp, parseLimit } from '@file-server/http-fastify';
import { JsonFileRepository } from '@file-server/repository-json';
import { SqliteFileRepository } from '@file-server/repository-sqlite';
import { LocalFileStorage } from '@file-server/storage-local';
import { createS3Storage } from '@file-server/storage-s3';
import { createMetrics } from '@file-server/http-fastify';
import { runRetention } from '@file-server/retention';
import { loadConfig } from './config.js';

const config = loadConfig();
const { dataDir } = config;
const repository = config.metadataDriver === 'sqlite'
  ? new SqliteFileRepository(join(dataDir, 'metadata.db'))
  : new JsonFileRepository(join(dataDir, 'files.json'));
await repository.load();
if (config.storageDriver === 's3' && !config.s3Bucket) throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3');
const storage = config.storageDriver === 's3'
  ? createS3Storage({ bucket: config.s3Bucket!, region: config.s3Region, endpoint: config.s3Endpoint, forcePathStyle: config.s3ForcePathStyle, accessKeyId: config.s3AccessKeyId, secretAccessKey: config.s3SecretAccessKey })
  : new LocalFileStorage(join(dataDir, 'objects'));
const metrics = createMetrics();
const app = createApp({
  apiKey: config.apiKey,
  ...(config.apiKeys ? { apiKeys: config.apiKeys } : {}),
  maxFileSize: parseLimit(String(config.maxFileSizeBytes)),
  ...(config.maxStorageBytesPerPrincipal > 0 ? { quotaBytesPerPrincipal: config.maxStorageBytesPerPrincipal } : {}),
  allowedMimeTypes: config.allowedMimeTypes,
  rateLimitMax: config.rateLimitMax,
  metrics,
  storage,
  repository,
});
await app.listen({ host: config.host, port: config.port });

let retentionTimer: NodeJS.Timeout | undefined;
if (config.retentionMaxAgeSeconds > 0) {
  const runCleanup = (): void => {
    void runRetention(repository, storage, {
      maxAgeMs: config.retentionMaxAgeSeconds * 1000,
      onError: (record, error) => app.log.error({ error, fileId: record.id }, 'retention cleanup failed'),
    })
      .then((result) => app.log.info(result, 'retention cleanup completed'))
      .catch((error: unknown) => app.log.error({ error }, 'retention scan failed'));
  };
  runCleanup();
  retentionTimer = setInterval(runCleanup, config.retentionIntervalSeconds * 1000);
  retentionTimer.unref();
}

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'shutting down');
  if (retentionTimer) clearInterval(retentionTimer);
  await app.close();
  process.exit(0);
};
process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
