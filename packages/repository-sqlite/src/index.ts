import initSqlJs, { type Database } from 'sql.js';
import { createRequire } from 'node:module';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { FileRecord, FileRepository } from '@file-server/core';

export class SqliteFileRepository implements FileRepository {
  private readonly database: Promise<Database>;
  private readonly file: string;

  public constructor(file: string) {
    this.file = file;
    this.database = this.open(file);
  }

  private async open(file: string): Promise<Database> {
    const require = createRequire(import.meta.url);
    const SQL = await initSqlJs({ locateFile: (name) => join(dirname(require.resolve('sql.js')), name) });
    let database: Database;
    try {
      database = new SQL.Database(new Uint8Array(await readFile(file)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      database = new SQL.Database();
    }
    database.run(`CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL DEFAULT 'default',
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL CHECK (size >= 0),
      checksum TEXT NOT NULL,
      created_at TEXT NOT NULL
    );`);
    try { database.run("ALTER TABLE files ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'default'"); } catch { /* already migrated */ }
    database.run('CREATE INDEX IF NOT EXISTS files_created_at_idx ON files(created_at DESC)');
    database.run('CREATE INDEX IF NOT EXISTS files_owner_id_idx ON files(owner_id)');
    return database;
  }

  public async create(record: FileRecord): Promise<void> {
    const database = await this.database;
    database.run('INSERT INTO files (id, owner_id, name, mime_type, size, checksum, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [record.id, record.ownerId, record.name, record.mimeType, record.size, record.checksum, record.createdAt]);
    await this.persist(database);
  }

  public async load(): Promise<void> {
    await this.database;
  }

  public async list(limit: number, offset: number, ownerId?: string): Promise<readonly FileRecord[]> {
    const database = await this.database;
    return query(database, ownerId ? 'SELECT id, owner_id, name, mime_type, size, checksum, created_at FROM files WHERE owner_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?' : 'SELECT id, owner_id, name, mime_type, size, checksum, created_at FROM files ORDER BY created_at DESC LIMIT ? OFFSET ?', ownerId ? [ownerId, limit, offset] : [limit, offset]).map(toRecord);
  }

  public async findById(id: string, ownerId?: string): Promise<FileRecord | null> {
    const rows = query(await this.database, ownerId ? 'SELECT id, owner_id, name, mime_type, size, checksum, created_at FROM files WHERE id = ? AND owner_id = ?' : 'SELECT id, owner_id, name, mime_type, size, checksum, created_at FROM files WHERE id = ?', ownerId ? [id, ownerId] : [id]);
    const row = rows[0];
    return row ? toRecord(row) : null;
  }

  public async delete(id: string, ownerId?: string): Promise<void> {
    const database = await this.database;
    database.run(ownerId ? 'DELETE FROM files WHERE id = ? AND owner_id = ?' : 'DELETE FROM files WHERE id = ?', ownerId ? [id, ownerId] : [id]);
    await this.persist(database);
  }

  public async totalSize(ownerId?: string): Promise<number> {
    const rows = query(await this.database, ownerId ? 'SELECT COALESCE(SUM(size), 0) AS total_size FROM files WHERE owner_id = ?' : 'SELECT COALESCE(SUM(size), 0) AS total_size FROM files', ownerId ? [ownerId] : []);
    return Number((rows[0] as unknown as { total_size: number } | undefined)?.total_size ?? 0);
  }

  public async close(): Promise<void> {
    (await this.database).close();
  }

  private async persist(database: Database): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}.tmp`;
    await writeFile(temporary, Buffer.from(database.export()));
    await rename(temporary, this.file);
  }
}

interface SqliteRow { id: string; owner_id: string; name: string; mime_type: string; size: number; checksum: string; created_at: string; total_size?: number }
type SqlValue = string | number | null | Uint8Array;
const query = (database: Database, sql: string, params: readonly SqlValue[]): SqliteRow[] => {
  const statement = database.prepare(sql);
  statement.bind([...params]);
  const rows: SqliteRow[] = [];
  while (statement.step()) rows.push(statement.getAsObject() as unknown as SqliteRow);
  statement.free();
  return rows;
};
const toRecord = (row: SqliteRow): FileRecord => ({ id: String(row.id), ownerId: String(row.owner_id), name: String(row.name), mimeType: String(row.mime_type), size: Number(row.size), checksum: String(row.checksum), createdAt: String(row.created_at) });
