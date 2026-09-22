'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const hpp = require('hpp');
require('dotenv').config();

const fileUpload = require('../lib/index');
const {
  deleteStoredFile,
  ensureStorageDirectory,
  resolveStoragePath,
  saveUploadedFile
} = require('./storage');

const app = express();
const port = Number(process.env.PORT || 3000);
const storageDirectory = path.resolve(__dirname, process.env.WRITE_PATH || './uploads');

app.disable('x-powered-by');
app.use(cors({ origin: process.env.CORS_ORIGIN || false }));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(hpp());
app.use(rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false
}));
app.use(fileUpload({
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024),
    files: 1
  },
  abortOnLimit: true,
  safeFileNames: true,
  preserveExtension: true
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (_req, res) => {
  res.json({
    name: 'nodejs-file-server',
    endpoints: ['POST /upload', 'GET /files/:path', 'DELETE /files/:path']
  });
});

app.post('/upload', async (req, res, next) => {
  try {
    const uploadedFile = req.files && req.files.file;
    if (!uploadedFile) {
      return res.status(400).json({ error: 'file_required' });
    }

    const requestedPath = typeof req.query.path === 'string'
      ? req.query.path
      : uploadedFile.name;
    const destinationPath = await saveUploadedFile(uploadedFile, storageDirectory, requestedPath);

    return res.status(201).json({
      name: path.basename(destinationPath),
      path: path.relative(storageDirectory, destinationPath),
      size: uploadedFile.size,
      mimetype: uploadedFile.mimetype
    });
  } catch (error) {
    if (error && error.code === 'PATH_OUTSIDE_STORAGE') {
      return res.status(400).json({ error: 'invalid_file_path' });
    }
    if (error && error.code === 'EEXIST') {
      return res.status(409).json({ error: 'file_already_exists' });
    }
    return next(error);
  }
});

app.get('/files/*', async (req, res, next) => {
  try {
    const requestedPath = decodeURIComponent(req.params[0]);
    const filePath = resolveStoragePath(storageDirectory, requestedPath);
    return res.sendFile(filePath);
  } catch (error) {
    if (error && error.code === 'PATH_OUTSIDE_STORAGE') {
      return res.status(400).json({ error: 'invalid_file_path' });
    }
    return next(error);
  }
});

app.delete('/files/*', async (req, res, next) => {
  try {
    await deleteStoredFile(storageDirectory, decodeURIComponent(req.params[0]));
    return res.status(204).send();
  } catch (error) {
    if (error && error.code === 'PATH_OUTSIDE_STORAGE') {
      return res.status(400).json({ error: 'invalid_file_path' });
    }
    if (error && error.code === 'ENOENT') {
      return res.status(404).json({ error: 'file_not_found' });
    }
    return next(error);
  }
});

app.use((error, _req, res, _next) => { // eslint-disable-line no-unused-vars
  if (res.headersSent) return;
  console.error(error); // eslint-disable-line no-console
  res.status(500).json({ error: 'internal_server_error' });
});

const start = async () => {
  await ensureStorageDirectory(storageDirectory);
  return app.listen(port, () => {
    console.log(`nodejs-file-server listening on port ${port}`); // eslint-disable-line no-console
  });
};

if (require.main === module) {
  start().catch((error) => {
    console.error(error); // eslint-disable-line no-console
    process.exitCode = 1;
  });
}

module.exports = { app, start, storageDirectory };
