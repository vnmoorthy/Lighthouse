/**
 * Tiny key-value abstraction over the `kv` table.
 * Used for: last-sync cursor, encrypted refresh token, vault salt+verifier,
 * generated API bearer token, etc.
 */
import { getDb } from './index.js';

export function kvGet(key: string): string | null {
  const row = getDb()
    .prepare('SELECT value FROM kv WHERE key = ?')
    .get(key) as { value: string | null } | undefined;
  return row?.value ?? null;
}

export function kvSet(key: string, value: string | null): void {
  getDb()
    .prepare(
      `INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, value, Date.now());
}

export function kvDelete(key: string): void {
  getDb().prepare('DELETE FROM kv WHERE key = ?').run(key);
}

/** Convenience: JSON serialize on the way in / out. */
export function kvGetJSON<T>(key: string): T | null {
  const v = kvGet(key);
  if (v == null) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

export function kvSetJSON(key: string, value: unknown): void {
  kvSet(key, JSON.stringify(value));
}

// --- Well-known keys --------------------------------------------------------
export const KV_KEYS = {
  vaultSalt: 'vault.salt',
  vaultVerifier: 'vault.verifier',
  gmailRefreshTokenEncrypted: 'gmail.refresh_token.enc',
  gmailUserEmail: 'gmail.user_email',
  apiBearerToken: 'api.bearer_token',
  syncCursor: 'sync.cursor_internal_date',
  syncLastFinishedAt: 'sync.last_finished_at',
  setupCompletedAt: 'setup.completed_at',
} as const;
