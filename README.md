# Node.js File Server

Open-source, modular Node.js file server and production starter kit. It provides a secure HTTP API for file upload, metadata, streaming download, range requests, and deletion while keeping domain contracts independent from the HTTP framework and storage implementation.

## Packages

- `@file-server/core` — framework-agnostic domain contracts and typed errors.
- `@file-server/storage-local` — atomic local filesystem storage with SHA-256 checksums.
- `@file-server/storage-s3` — AWS S3-compatible object storage adapter for S3, MinIO, R2, and compatible providers.
- `@file-server/repository-json` — atomic JSON metadata repository for single-instance starter deployments.
- `@file-server/repository-sqlite` — portable SQLite metadata repository for starter deployments.
- `@file-server/retention` — configurable object and metadata retention cleanup.
- `@file-server/http-fastify` — Fastify routes, auth, validation, request IDs, and OpenAPI.
- `@file-server/app` — production-oriented starter application.

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm dev
```

The API is available at `http://localhost:3000`; Swagger UI is at `/documentation`.

The machine-readable OpenAPI document is available at `/documentation/json`. Protected operations use the `ApiKeyAuth` security scheme and public probes are limited to `/health/live` and `/health/ready`.

Prometheus-compatible metrics are available at `/metrics` and require the same API key. They include request totals, latency histograms, and successful upload counts.

Per-principal quotas are disabled by default. Set `MAX_STORAGE_BYTES_PER_PRINCIPAL` to a positive byte value to enforce a tenant quota. Retention is also disabled by default; set `RETENTION_MAX_AGE_SECONDS` and optionally `RETENTION_INTERVAL_SECONDS` to enable periodic cleanup of expired files.

```bash
curl -X POST http://localhost:3000/v1/files \
  -H 'x-api-key: change-me-in-production' \
  -F 'file=@README.md'
```

For production, set `NODE_ENV=production` and provide an `API_KEY` with at least 16 characters. The starter rejects the development fallback key in production. Downloads support HTTP byte ranges for resumable clients.

## API

`POST /v1/files`, `GET /v1/files`, `GET /v1/files/:id`, `GET /v1/files/:id/content`, and `DELETE /v1/files/:id` are authenticated with `x-api-key`. Health endpoints are public: `/health/live` and `/health/ready`.

## Production notes

The local adapter is intentionally replaceable. For production at scale, implement the `FileStorage` contract with S3-compatible object storage and use a durable metadata repository. Put the service behind TLS, rotate API keys, configure a non-public data volume, and set an explicit MIME/size policy.

The included `@file-server/storage-s3` adapter supports AWS S3 and compatible endpoints such as MinIO and R2. Configure `STORAGE_DRIVER=s3`, `S3_BUCKET`, and `S3_REGION`; credentials use the AWS SDK default provider chain unless explicit credentials are supplied. npm publication is planned; packages are currently consumed from this monorepo.

See [`docs/production.md`](docs/production.md) for the launch checklist and [`SECURITY.md`](SECURITY.md) for vulnerability reporting.

## Development

```bash
pnpm check
pnpm format
```

Run the production starter locally with Docker Compose:

```bash
docker compose up --build
```

Licensed under MIT. Contributions are welcome.
