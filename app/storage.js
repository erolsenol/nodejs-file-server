'use strict';

const fs = require('fs/promises');
const path = require('path');

const isPathInside = (rootDir, candidatePath) => {
  const relativePath = path.relative(rootDir, candidatePath);
  return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
};

const resolveStoragePath = (rootDir, requestedPath) => {
  if (typeof requestedPath !== 'string' || requestedPath.trim() === '') {
    const error = new Error('A file path is required.');
    error.code = 'INVALID_FILE_PATH';
    throw error;
  }

  const resolvedRoot = path.resolve(rootDir);
  const resolvedPath = path.resolve(resolvedRoot, requestedPath);

  if (!isPathInside(resolvedRoot, resolvedPath)) {
    const error = new Error('The requested path is outside the storage directory.');
    error.code = 'PATH_OUTSIDE_STORAGE';
    throw error;
  }

  return resolvedPath;
};

const ensureStorageDirectory = async (rootDir) => {
  await fs.mkdir(rootDir, { recursive: true });
};

const saveUploadedFile = async (file, rootDir, requestedPath) => {
  const destinationPath = resolveStoragePath(rootDir, requestedPath);
  try {
    await fs.access(destinationPath);
    const error = new Error('The destination file already exists.');
    error.code = 'EEXIST';
    throw error;
  } catch (error) {
    if (error && error.code !== 'ENOENT') throw error;
  }
  await ensureStorageDirectory(path.dirname(destinationPath));
  await file.mv(destinationPath);
  return destinationPath;
};

const deleteStoredFile = async (rootDir, requestedPath) => {
  const filePath = resolveStoragePath(rootDir, requestedPath);
  await fs.unlink(filePath);
  return filePath;
};

module.exports = {
  deleteStoredFile,
  ensureStorageDirectory,
  isPathInside,
  resolveStoragePath,
  saveUploadedFile
};
