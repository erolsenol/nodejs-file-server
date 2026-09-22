# Production checklist

Before exposing the starter to real traffic:

- Set `NODE_ENV=production` and a randomly generated `API_KEY` of at least 16 characters.
- Put the service behind TLS and a reverse proxy with request and connection timeouts.
- The starter uses SQLite metadata by default. Set `STORAGE_DRIVER=s3` and configure `S3_BUCKET` for AWS S3, MinIO, R2, or another S3-compatible object store in multi-instance deployments.
- Back up metadata and objects together; test restore before launch.
- Set a narrow `ALLOWED_MIME_TYPES`, an explicit `MAX_FILE_SIZE_BYTES`, and an appropriate `RATE_LIMIT_MAX`.
- Set `MAX_STORAGE_BYTES_PER_PRINCIPAL` for a per-tenant storage ceiling. Set `RETENTION_MAX_AGE_SECONDS` only after confirming the deletion policy; `RETENTION_INTERVAL_SECONDS` controls the cleanup cadence.
- Retention deletes the object before metadata. Monitor the cleanup result logs and keep backups until restore testing confirms the policy is safe.
- Add application-level authorization if more than one user or tenant uses the service.
- For S3-compatible storage, prefer workload identity/instance roles over long-lived access keys; use `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE=true` for local MinIO.
- Ship logs to a protected sink and avoid logging API keys, file contents, or sensitive filenames.
- Configure the `NPM_TOKEN` repository secret before enabling automated npm publication; without it, Changesets versions packages and creates the release PR but intentionally skips registry publication.
- Scrape `/metrics` from a private network and alert on elevated 5xx rate, latency, upload failures, and storage readiness failures.
- Run `pnpm install --frozen-lockfile`, `pnpm audit --audit-level=high`, and `pnpm check` in CI.
- Build the Docker image with the included `docker/Dockerfile`, scan it for high/critical vulnerabilities, and publish only immutable semver tags.
- Treat `/health/live` as process health and `/health/ready` as storage readiness; do not use either as an authorization bypass.

The local JSON metadata repository is intentionally a starter implementation. It uses atomic replacement and serialized writes, but a multi-instance deployment requires a shared durable repository.

The in-process quota reservation and retention scheduler are safe for a single application instance. For multiple replicas, move quota accounting and retention coordination to a shared database/lock provider before enabling them as global policies.
