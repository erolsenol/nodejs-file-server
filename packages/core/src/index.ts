export interface FileRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly mimeType: string;
  readonly size: number;
  readonly checksum: string;
  readonly createdAt: string;
}

export interface FileStorage {
  put(input: NodeJS.ReadableStream, key: string): Promise<{ size: number; checksum: string }>;
  get(key: string, range?: { readonly start: number; readonly end: number }): Promise<NodeJS.ReadableStream>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  check(): Promise<void>;
}

export interface FileRepository {
  create(record: FileRecord): Promise<void>;
  list(limit: number, offset: number, ownerId?: string): Promise<readonly FileRecord[]>;
  findById(id: string, ownerId?: string): Promise<FileRecord | null>;
  delete(id: string, ownerId?: string): Promise<void>;
  totalSize?(ownerId?: string): Promise<number>;
}

export class FileServerError extends Error {
  public constructor(
    public readonly code: 'NOT_FOUND' | 'UNAUTHORIZED' | 'INVALID_INPUT' | 'LIMIT_EXCEEDED' | 'STORAGE_ERROR',
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'FileServerError';
  }
}
