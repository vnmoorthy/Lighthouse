/**
 * Migration runner. Applies SQL files in lexical order, exactly once each.
 *
 * Migration files live in ./migrations/NNNN_name.sql. The numeric prefix is
 * the version. We track which versions are applied in `schema_version`.
 */
import type Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from '../logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

interface Migration {
  version: number;
  name: string;
  sql: string;
}

function loadMigrations(): Migration[] {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  return files.map((f) => {
    const m = /^(\d+)_(.+)\.sql$/.exec(f);
    if (!m) throw new Error(`Bad migration filename: ${f}`);
    return {
      version: Number.parseInt(m[1]!, 10),
      name: m[2]!,
      sql: readFileSync(join(MIGRATIONS_DIR, f), 'utf-8'),
    };
  });
}

export function runMigrations(db: Database.Database): void {
  // Bootstrap: schema_version table may not exist yet, but the first migration
  // creates it. So we exec the first migration in a transaction and check if
  // schema_version exists before reading it.
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
    version    INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
  );`);

  const applied = new Set<number>(
    (db.prepare('SELECT version FROM schema_version').all() as { version: number }[]).map(
      (r) => r.version,
    ),
  );

  const migrations = loadMigrations();
  let pending = 0;
  const apply = db.transaction((m: Migration) => {
    db.exec(m.sql);
    db.prepare('INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?)').run(
      m.version,
      Date.now(),
    );
  });
  for (const m of migrations) {
    if (applied.has(m.version)) continue;
    log.info(`Applying migration ${String(m.version).padStart(4, '0')} ${m.name}`);
    apply(m);
    pending++;
  }
  if (pending === 0) log.debug('Schema is up to date');
  else log.info(`Applied ${pending} migration(s).`);
}
