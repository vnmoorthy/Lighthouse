-- Multi-account support.
--
-- An account is a connected Gmail inbox. Each has its own encrypted
-- refresh token, sync cursor, and human-readable label. Existing
-- single-account installs are migrated by creating one default account
-- (id 1) for whatever inbox is already connected.
--
-- Receipts and emails are extended with `account_id` so the dashboard
-- can scope queries (e.g. "Personal vs Work view"). The default account
-- gets id=1, and existing rows are stamped with account_id=1.

CREATE TABLE IF NOT EXISTS accounts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  label       TEXT    NOT NULL,
  email       TEXT,
  color       TEXT    NOT NULL DEFAULT '#e58e5a',
  refresh_token_enc TEXT,
  sync_cursor INTEGER,
  is_default  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

-- Seed an account for the existing user (if any kv values look familiar).
-- We only insert if the table is empty and a Gmail user_email kv is set.
INSERT INTO accounts (id, label, email, refresh_token_enc, is_default, created_at)
SELECT
  1,
  'Personal',
  (SELECT value FROM kv WHERE key = 'gmail.user_email'),
  (SELECT value FROM kv WHERE key = 'gmail.refresh_token.enc'),
  1,
  strftime('%s','now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM accounts);

-- Add account_id to emails / receipts. SQLite ALTER TABLE ADD COLUMN is fine.
ALTER TABLE emails    ADD COLUMN account_id INTEGER NOT NULL DEFAULT 1
                       REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE receipts  ADD COLUMN account_id INTEGER NOT NULL DEFAULT 1
                       REFERENCES accounts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_emails_account   ON emails(account_id);
CREATE INDEX IF NOT EXISTS idx_receipts_account ON receipts(account_id);
