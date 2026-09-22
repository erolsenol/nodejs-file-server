'use strict';

const assert = require('assert');
const path = require('path');
const {
  isPathInside,
  resolveStoragePath
} = require('../app/storage');

describe('storage path safety', () => {
  const rootDir = path.join(__dirname, 'storage-root');

  it('resolves paths inside the configured storage directory', () => {
    const resolvedPath = resolveStoragePath(rootDir, 'images/avatar.png');

    assert.strictEqual(resolvedPath, path.join(rootDir, 'images/avatar.png'));
    assert.strictEqual(isPathInside(rootDir, resolvedPath), true);
  });

  it('rejects traversal outside the storage directory', () => {
    assert.throws(
      () => resolveStoragePath(rootDir, '../secrets.txt'),
      (error) => error.code === 'PATH_OUTSIDE_STORAGE'
    );
  });

  it('rejects an empty path', () => {
    assert.throws(
      () => resolveStoragePath(rootDir, ''),
      (error) => error.code === 'INVALID_FILE_PATH'
    );
  });
});
