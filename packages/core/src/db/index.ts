/**
 * SQLite connection singleton + lifecycle helpers.
 *
 * better-sqlite3 is synchronous on purpose. For a single-user local app this
 * keeps code simpler and faster than the async sqlite3 driver — there is
 * never going to be > 1 writer at a time, and the OS buffer cache makes reads
 * trivial. We enable WAL mode anyway so we can read while writing.
 */
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { config, ensureHome } from '../config.js';
import { runMigrations } from './migrations.js';
import { log } from '../logger.js';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  ensureHome();
  const isNew = !existsSync(config.dbPath);
  _db = new Database(config.dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('synchronous = NORMAL');
  _db.pragma('temp_store = MEMORY');
  if (isNew) log.info(`Created new database at ${config.dbPath}`);
  runMigrations(_db);
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/** Run an arbitrary fn inside a transaction; commits on return, rolls back on throw. */
export function tx<T>(fn: (db: Database.Database) => T): T {
  const db = getDb();
  return db.transaction(fn)(db);
}

export * from './queries.js';
export * from './kv.js';
