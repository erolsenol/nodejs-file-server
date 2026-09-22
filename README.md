# Node.js File Server

Secure, lightweight file uploads for Express, built on Busboy. The repository
contains the reusable `express-fileupload` middleware API and a small server
example for local development.

[![CI](https://github.com/erolsenol/nodejs-file-server/actions/workflows/ci.yml/badge.svg)](https://github.com/erolsenol/nodejs-file-server/actions/workflows/ci.yml)

## Why this project?

- Multipart uploads with memory or temporary-file storage
- Promise and callback support through `file.mv()`
- File size, count and upload timeout limits
- Filename sanitisation and nested field parsing
- Prototype-pollution protections for parsed fields
- Security-focused local file-server example

The middleware API is intentionally compatible with the upstream
`express-fileupload` package. The example server is not intended to be an
internet-facing storage service without adding authentication, authorization,
TLS and a durable storage adapter.

## Install

```bash
npm install express-fileupload
```

## Middleware usage

```js
const express = require('express');
const fileUpload = require('express-fileupload');

const app = express();

app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 },
  abortOnLimit: true,
  useTempFiles: true,
  tempFileDir: '/tmp/file-uploads'
}));

app.post('/upload', async (req, res, next) => {
  try {
    const file = req.files && req.files.file;
    if (!file) return res.status(400).json({ error: 'file_required' });

    await file.mv(`/srv/uploads/${file.name}`);
    return res.status(201).json({ name: file.name, size: file.size });
  } catch (error) {
    return next(error);
  }
});
```

## Run the example server

```bash
cp .env.example .env
npm install
npm run dev
```

Endpoints:

- `GET /health` — health check
- `POST /upload` — multipart field name `file`; optional query `path`
- `GET /files/<path>` — download a stored file
- `DELETE /files/<path>` — delete a stored file

The example rejects paths outside its configured storage directory, limits
uploads to 10 MiB by default, prevents overwrites through the middleware’s
destination behavior, and keeps CORS disabled unless `CORS_ORIGIN` is set.

## Development

```bash
npm ci
npm run check       # lint + tests
npm run test:unit   # tests without coverage output
```

Node.js 18, 20 and 22 are tested in CI. Run the server only with trusted
clients and configure authentication before exposing upload or delete routes.

## Contributing

Bug reports, security reports and pull requests are welcome. Please read
[`SECURITY.md`](SECURITY.md) before reporting a vulnerability.

## License

MIT. See [`LICENSE`](LICENSE).
