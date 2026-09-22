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
});
