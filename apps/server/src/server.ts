import 'dotenv/config';
import { join } from 'node:path';
import { createApp, parseLimit } from '@file-server/http-fastify';
import { JsonFileRepository } from '@file-server/repository-json';
import { SqliteFileRepository } from '@file-server/repository-sqlite';
import { LocalFileStorage } from '@file-server/storage-local';
import { loadConfig } from './config.js';

const config = loadConfig();
const { dataDir } = config;
const repository = config.metadataDriver === 'sqlite'
  ? new SqliteFileRepository(join(dataDir, 'metadata.db'))
  : new JsonFileRepository(join(dataDir, 'files.json'));
await repository.load();
const storage = new LocalFileStorage(join(dataDir, 'objects'));
const app = createApp({
  apiKey: config.apiKey,
  maxFileSize: parseLimit(String(config.maxFileSizeBytes)),
  allowedMimeTypes: config.allowedMimeTypes,
  rateLimitMax: config.rateLimitMax,
  storage,
  repository,
});
await app.listen({ host: config.host, port: config.port });

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  process.exit(0);
};
process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
