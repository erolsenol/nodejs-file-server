import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATA_DIR: z.string().min(1).default('.data'),
  METADATA_DRIVER: z.enum(['sqlite', 'json']).default('sqlite'),
  API_KEY: z.string().min(16).default('development-only-change-me'),
  MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  ALLOWED_MIME_TYPES: z.string().default('application/pdf,image/jpeg,image/png,text/plain,application/zip'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
});

export interface AppConfig {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly host: string;
  readonly port: number;
  readonly dataDir: string;
  readonly metadataDriver: 'sqlite' | 'json';
  readonly apiKey: string;
  readonly maxFileSizeBytes: number;
  readonly allowedMimeTypes: ReadonlySet<string>;
  readonly rateLimitMax: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.parse(env);
  if (parsed.NODE_ENV === 'production' && parsed.API_KEY === 'development-only-change-me') {
    throw new Error('API_KEY must be changed before starting in production');
  }
  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    dataDir: parsed.DATA_DIR,
    metadataDriver: parsed.METADATA_DRIVER,
    apiKey: parsed.API_KEY,
    maxFileSizeBytes: parsed.MAX_FILE_SIZE_BYTES,
    allowedMimeTypes: new Set(parsed.ALLOWED_MIME_TYPES.split(',').map((value) => value.trim()).filter(Boolean)),
    rateLimitMax: parsed.RATE_LIMIT_MAX,
  };
}
