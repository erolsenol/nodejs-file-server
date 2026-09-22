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
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL CHECK (size >= 0),
      checksum TEXT NOT NULL,
      created_at TEXT NOT NULL
    ); CREATE INDEX IF NOT EXISTS files_created_at_idx ON files(created_at DESC);`);
    return database;
  }

  public async create(record: FileRecord): Promise<void> {
    const database = await this.database;
    database.run('INSERT INTO files (id, name, mime_type, size, checksum, created_at) VALUES (?, ?, ?, ?, ?, ?)', [record.id, record.name, record.mimeType, record.size, record.checksum, record.createdAt]);
    await this.persist(database);
  }

  public async load(): Promise<void> {
    await this.database;
  }

  public async list(limit: number, offset: number): Promise<readonly FileRecord[]> {
    const database = await this.database;
    return query(database, 'SELECT id, name, mime_type, size, checksum, created_at FROM files ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]).map(toRecord);
  }

  public async findById(id: string): Promise<FileRecord | null> {
    const rows = query(await this.database, 'SELECT id, name, mime_type, size, checksum, created_at FROM files WHERE id = ?', [id]);
    const row = rows[0];
    return row ? toRecord(row) : null;
  }

  public async delete(id: string): Promise<void> {
    const database = await this.database;
    database.run('DELETE FROM files WHERE id = ?', [id]);
    await this.persist(database);
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

interface SqliteRow { id: string; name: string; mime_type: string; size: number; checksum: string; created_at: string }
type SqlValue = string | number | null | Uint8Array;
const query = (database: Database, sql: string, params: readonly SqlValue[]): SqliteRow[] => {
  const statement = database.prepare(sql);
  statement.bind([...params]);
  const rows: SqliteRow[] = [];
  while (statement.step()) rows.push(statement.getAsObject() as unknown as SqliteRow);
  statement.free();
  return rows;
};
const toRecord = (row: SqliteRow): FileRecord => ({ id: String(row.id), name: String(row.name), mimeType: String(row.mime_type), size: Number(row.size), checksum: String(row.checksum), createdAt: String(row.created_at) });
