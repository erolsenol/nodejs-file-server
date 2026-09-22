import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('rejects the development key in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow('API_KEY must be changed');
  });

  it('parses a production-safe configuration', () => {
    const config = loadConfig({ NODE_ENV: 'production', API_KEY: 'a-secure-key-with-more-than-16-chars' });
    expect(config.port).toBe(3000);
    expect(config.allowedMimeTypes.has('text/plain')).toBe(true);
  });

  it('parses scoped API keys without exposing secrets', () => {
    const config = loadConfig({ API_KEYS: 'team-a:secret-a,team-b:secret-b' });
    expect(config.apiKeys).toEqual(new Map([['team-a', 'secret-a'], ['team-b', 'secret-b']]));
  });

  it('rejects duplicate scoped API key principals', () => {
    expect(() => loadConfig({ API_KEYS: 'team-a:secret-a,team-a:secret-b' })).toThrow('Duplicate API_KEYS principal: team-a');
  });

  it('keeps quota and retention disabled by default and parses explicit values', () => {
    expect(loadConfig({ MAX_STORAGE_BYTES_PER_PRINCIPAL: '1024', RETENTION_MAX_AGE_SECONDS: '86400', RETENTION_INTERVAL_SECONDS: '300' })).toMatchObject({
      maxStorageBytesPerPrincipal: 1024,
      retentionMaxAgeSeconds: 86400,
      retentionIntervalSeconds: 300,
    });
  });
});
