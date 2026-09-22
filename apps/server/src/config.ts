import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATA_DIR: z.string().min(1).default('.data'),
  METADATA_DRIVER: z.enum(['sqlite', 'json']).default('sqlite'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  API_KEY: z.string().min(16).default('development-only-change-me'),
  API_KEYS: z.string().optional(),
  MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  MAX_STORAGE_BYTES_PER_PRINCIPAL: z.coerce.number().int().nonnegative().default(0),
  RETENTION_MAX_AGE_SECONDS: z.coerce.number().int().nonnegative().default(0),
  RETENTION_INTERVAL_SECONDS: z.coerce.number().int().positive().default(3600),
  ALLOWED_MIME_TYPES: z.string().default('application/pdf,image/jpeg,image/png,text/plain,application/zip'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
});

export interface AppConfig {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly host: string;
  readonly port: number;
  readonly dataDir: string;
  readonly metadataDriver: 'sqlite' | 'json';
  readonly storageDriver: 'local' | 's3';
  readonly s3Bucket: string | undefined;
  readonly s3Region: string;
  readonly s3Endpoint: string | undefined;
  readonly s3ForcePathStyle: boolean;
  readonly s3AccessKeyId: string | undefined;
  readonly s3SecretAccessKey: string | undefined;
  readonly apiKey: string;
  readonly apiKeys: ReadonlyMap<string, string> | undefined;
  readonly maxFileSizeBytes: number;
  readonly maxStorageBytesPerPrincipal: number;
  readonly retentionMaxAgeSeconds: number;
  readonly retentionIntervalSeconds: number;
  readonly allowedMimeTypes: ReadonlySet<string>;
  readonly rateLimitMax: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.parse(env);
  if (parsed.NODE_ENV === 'production' && parsed.API_KEY === 'development-only-change-me') {
    throw new Error('API_KEY must be changed before starting in production');
  }
  const apiKeys = parsed.API_KEYS ? new Map(parsed.API_KEYS.split(',').map((entry) => {
    const separator = entry.indexOf(':');
    if (separator < 1 || separator === entry.length - 1) throw new Error('API_KEYS entries must use id:secret format');
    return [entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()] as const;
  })) : undefined;
  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    dataDir: parsed.DATA_DIR,
    metadataDriver: parsed.METADATA_DRIVER,
    storageDriver: parsed.STORAGE_DRIVER,
    s3Bucket: parsed.S3_BUCKET,
    s3Region: parsed.S3_REGION,
    s3Endpoint: parsed.S3_ENDPOINT,
    s3ForcePathStyle: parsed.S3_FORCE_PATH_STYLE,
    s3AccessKeyId: parsed.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: parsed.S3_SECRET_ACCESS_KEY,
    apiKey: parsed.API_KEY,
    apiKeys,
    maxFileSizeBytes: parsed.MAX_FILE_SIZE_BYTES,
    maxStorageBytesPerPrincipal: parsed.MAX_STORAGE_BYTES_PER_PRINCIPAL,
    retentionMaxAgeSeconds: parsed.RETENTION_MAX_AGE_SECONDS,
    retentionIntervalSeconds: parsed.RETENTION_INTERVAL_SECONDS,
    allowedMimeTypes: new Set(parsed.ALLOWED_MIME_TYPES.split(',').map((value) => value.trim()).filter(Boolean)),
    rateLimitMax: parsed.RATE_LIMIT_MAX,
  };
}
