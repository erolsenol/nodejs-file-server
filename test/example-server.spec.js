'use strict';

const assert = require('assert');
const fs = require('fs/promises');
const path = require('path');
const request = require('supertest');

process.env.WRITE_PATH = '../test/example-server-uploads';

const { app, storageDirectory } = require('../app/server');

describe('example file server', () => {
  after(async () => {
    await fs.rm(storageDirectory, { recursive: true, force: true });
  });

  it('reports health', async () => {
    const response = await request(app).get('/health');

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(response.body, { status: 'ok' });
  });

  it('uploads, downloads and deletes a file inside storage', async () => {
    const upload = await request(app)
      .post('/upload?path=documents/hello.txt')
      .attach('file', Buffer.from('hello open source'), 'hello.txt');

    assert.strictEqual(upload.status, 201);
    assert.strictEqual(upload.body.path, 'documents/hello.txt');

    const download = await request(app).get('/files/documents/hello.txt');
    assert.strictEqual(download.status, 200);
    assert.strictEqual(download.text, 'hello open source');

    const deletion = await request(app).delete('/files/documents/hello.txt');
    assert.strictEqual(deletion.status, 204);
  });

  it('rejects paths outside storage', async () => {
    const response = await request(app)
      .post('/upload?path=../outside.txt')
      .attach('file', Buffer.from('blocked'), 'blocked.txt');

    assert.strictEqual(response.status, 400);
    assert.strictEqual(response.body.error, 'invalid_file_path');
    const outsidePath = path.join(path.dirname(storageDirectory), 'outside.txt');
    assert.strictEqual(await fileExists(outsidePath), false);
  });
});

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
};
