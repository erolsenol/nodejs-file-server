import multipart from '@fastify/multipart';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FileRepository, FileStorage } from '@file-server/core';
import { FileServerError } from '@file-server/core';
import Fastify, { type FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import type { FileServerMetrics } from './metrics.js';

export interface HttpOptions {
  readonly apiKey: string;
  readonly apiKeys?: ReadonlyMap<string, string>;
  readonly maxFileSize: number;
  readonly allowedMimeTypes: ReadonlySet<string>;
  readonly storage: FileStorage;
  readonly repository: FileRepository;
  readonly rateLimitMax?: number;
  readonly quotaBytesPerPrincipal?: number;
  readonly metrics?: FileServerMetrics;
}

interface ByteRange {
  readonly start: number;
  readonly end: number;
}

interface Principal { readonly id: string }
type PublicFileRecord = Omit<import('@file-server/core').FileRecord, 'ownerId'>;
const toPublicRecord = (record: import('@file-server/core').FileRecord): PublicFileRecord => {
  const { ownerId, ...publicRecord } = record;
  void ownerId;
  return publicRecord;
};

const parseLimit = (value: string | undefined): number => {
  const parsed = Number(value ?? String(50 * 1024 * 1024));
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 50 * 1024 * 1024;
};

const parseRange = (header: string | undefined, size: number): ByteRange | null => {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(size - Number(match[2]), 0);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
};

const safeDownloadName = (name: string): string => name.replace(/[^\x20-\x7E]/g, '_').replace(/[\\"]/g, '_');

export function createApp(options: HttpOptions): FastifyInstance {
  const app = Fastify({ logger: true, requestIdHeader: 'x-request-id' });
  const quotaBytesPerPrincipal = options.quotaBytesPerPrincipal;
  const quotaReservations = new Map<string, number>();
  const startTimes = new WeakMap<object, bigint>();
  app.addHook('onRequest', async (request) => { startTimes.set(request, process.hrtime.bigint()); });
  app.addHook('onResponse', async (request, reply) => {
    if (!options.metrics) return;
    const start = startTimes.get(request);
    const duration = start ? Number(process.hrtime.bigint() - start) / 1_000_000_000 : 0;
    const route = request.routeOptions.url ?? 'unknown';
    const labels = { method: request.method, route, status: String(reply.statusCode) };
    options.metrics.requestsTotal.inc(labels);
    options.metrics.requestDurationSeconds.observe(labels, duration);
  });
  void app.register(multipart, { limits: { fileSize: options.maxFileSize, files: 1 } });
  void app.register(helmet, { global: true });
  void app.register(rateLimit, { max: options.rateLimitMax ?? 100, timeWindow: '1 minute' });
  void app.register(swagger, {
    openapi: {
      info: { title: 'Node.js File Server', version: '0.1.0' },
      tags: [{ name: 'files', description: 'File metadata and content operations' }, { name: 'health', description: 'Service health probes' }],
      components: { securitySchemes: { ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' } } },
    },
  });
  void app.register(swaggerUi, { routePrefix: '/documentation' });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof FileServerError) return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message }, requestId: request.id });
    request.log.error(error);
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' }, requestId: request.id });
  });

  const authenticate = (request: { headers: Record<string, string | string[] | undefined> }): Principal => {
    const presented = request.headers['x-api-key'];
    if (typeof presented !== 'string') throw new FileServerError('UNAUTHORIZED', 'Invalid API key', 401);
    if (options.apiKeys) {
      for (const [id, secret] of options.apiKeys) if (secret === presented) return { id };
    } else if (presented === options.apiKey) return { id: 'default' };
    throw new FileServerError('UNAUTHORIZED', 'Invalid API key', 401);
  };

  app.get('/metrics', async (request, reply) => {
    authenticate(request);
    if (!options.metrics) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Metrics are disabled' } });
    reply.type(options.metrics.registry.contentType);
    return options.metrics.registry.metrics();
  });

  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async (_request, reply) => { await options.storage.check(); return reply.send({ status: 'ok' }); });

  app.post('/v1/files', async (request, reply) => {
    const principal = authenticate(request);
    const part = await request.file();
    if (!part) throw new FileServerError('INVALID_INPUT', 'A file is required', 400);
    if (!options.allowedMimeTypes.has(part.mimetype)) throw new FileServerError('INVALID_INPUT', 'MIME type is not allowed', 415);
    const id = ulid();
    const stored = await options.storage.put(part.file, id);
    if (part.file.truncated) { await options.storage.delete(id); throw new FileServerError('LIMIT_EXCEEDED', 'File is too large', 413); }
    let reservedSize = 0;
    try {
      if (quotaBytesPerPrincipal !== undefined) {
        const currentUsage = options.repository.totalSize ? await options.repository.totalSize(principal.id) : 0;
        const reservedUsage = quotaReservations.get(principal.id) ?? 0;
        if (currentUsage + reservedUsage + stored.size > quotaBytesPerPrincipal) {
          await options.storage.delete(id);
          throw new FileServerError('LIMIT_EXCEEDED', 'Storage quota exceeded', 413);
        }
        quotaReservations.set(principal.id, reservedUsage + stored.size);
        reservedSize = stored.size;
      }
      const record = { id, ownerId: principal.id, name: part.filename, mimeType: part.mimetype, ...stored, createdAt: new Date().toISOString() } as const;
      try {
        await options.repository.create(record);
      } catch (error) {
        try { await options.storage.delete(id); } catch (cleanupError) { request.log.error({ cleanupError, id }, 'failed to clean up orphaned upload'); }
        throw error;
      }
      options.metrics?.uploadsTotal.inc({ status: 'success' });
      return reply.code(201).send(toPublicRecord(record));
    } finally {
      if (reservedSize > 0) {
        const remaining = (quotaReservations.get(principal.id) ?? 0) - reservedSize;
        if (remaining > 0) quotaReservations.set(principal.id, remaining);
        else quotaReservations.delete(principal.id);
      }
    }
  });

  app.get('/v1/files', async (request) => {
    const principal = authenticate(request);
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(Math.max(Number(query.limit ?? 50) || 50, 1), 100);
    const offset = Math.max(Number(query.offset ?? 0) || 0, 0);
    return { data: (await options.repository.list(limit, offset, principal.id)).map(toPublicRecord), limit, offset };
  });

  app.get<{ Params: { id: string } }>('/v1/files/:id', async (request) => { const principal = authenticate(request); const record = await options.repository.findById(request.params.id, principal.id); if (!record) throw new FileServerError('NOT_FOUND', 'File not found', 404); return toPublicRecord(record); });
  app.get<{ Params: { id: string } }>('/v1/files/:id/content', async (request, reply) => {
    const principal = authenticate(request);
    const record = await options.repository.findById(request.params.id, principal.id);
    if (!record || !(await options.storage.exists(request.params.id))) throw new FileServerError('NOT_FOUND', 'File not found', 404);
    const rangeHeader = typeof request.headers.range === 'string' ? request.headers.range : undefined;
    const range = parseRange(rangeHeader, record.size);
    if (rangeHeader && !range) return reply.code(416).header('content-range', `bytes */${record.size}`).send();
    reply.type(record.mimeType)
      .header('accept-ranges', 'bytes')
      .header('content-disposition', `attachment; filename="${safeDownloadName(record.name)}"`);
    if (!range) return options.storage.get(request.params.id);
    const length = range.end - range.start + 1;
    reply.code(206).header('content-range', `bytes ${range.start}-${range.end}/${record.size}`).header('content-length', length);
    return options.storage.get(request.params.id, range);
  });
  app.delete<{ Params: { id: string } }>('/v1/files/:id', async (request, reply) => { const principal = authenticate(request); const record = await options.repository.findById(request.params.id, principal.id); if (!record) throw new FileServerError('NOT_FOUND', 'File not found', 404); await options.storage.delete(record.id); await options.repository.delete(record.id, principal.id); return reply.code(204).send(); });
  return app;
}

export { parseLimit };
export { createMetrics } from './metrics.js';
