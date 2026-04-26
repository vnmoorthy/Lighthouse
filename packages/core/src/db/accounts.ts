/**
 * Account management.
 *
 * v0.20 ships the schema + read API for accounts. The OAuth flow still
 * writes to kv (gmail.refresh_token.enc) and account #1 is created from
 * those values by the migration. Adding a *second* account currently
 * requires inserting a row by hand or via SQL — a follow-up release will
 * extend `lighthouse setup --add-account` to do this end-to-end.
 *
 * We keep accounts in their own file so the surface area stays clean: any
 * caller that wants to know "which inboxes does this user have" goes
 * through `listAccounts()` exclusively.
 */
import { getDb } from './index.js';

export interface Account {
  id: number;
  label: string;
  email: string | null;
  color: string;
  is_default: number;
  created_at: number;
  // Sensitive fields (refresh_token_enc, sync_cursor) intentionally NOT
  // exposed via `Account` — call sites that need them should query
  // accounts directly.
}

export function listAccounts(): Account[] {
  return getDb()
    .prepare(
      `SELECT id, label, email, color, is_default, created_at
       FROM accounts ORDER BY id`,
    )
    .all() as Account[];
}

export function getDefaultAccount(): Account | null {
  return (
    (getDb()
      .prepare(
        `SELECT id, label, email, color, is_default, created_at
         FROM accounts WHERE is_default = 1 LIMIT 1`,
      )
      .get() as Account | undefined) ?? null
  );
}

export function createAccount(input: {
  label: string;
  email: string | null;
  color?: string;
}): number {
  const r = getDb()
    .prepare(
      `INSERT INTO accounts (label, email, color, is_default, created_at)
       VALUES (?,?,?,?,?)`,
    )
    .run(input.label, input.email, input.color ?? '#e58e5a', 0, Date.now());
  return Number(r.lastInsertRowid);
}

export function setAccountLabel(id: number, label: string): void {
  getDb().prepare('UPDATE accounts SET label = ? WHERE id = ?').run(label, id);
}
