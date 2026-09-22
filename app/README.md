# Example server

This directory contains a minimal local file server built on the middleware in
`../lib`. It demonstrates safe path resolution, upload limits, rate limiting,
health checks and async filesystem operations.

Run it from the repository root:

```bash
cp .env.example .env
npm run dev
```

The server stores files under `WRITE_PATH`, rejects traversal attempts and does
not enable cross-origin requests unless `CORS_ORIGIN` is configured. Add
authentication and authorization before using these routes in production.
