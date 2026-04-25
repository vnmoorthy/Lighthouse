-- Lighthouse initial schema (v1).
--
-- Notes:
--   - Money is stored as integer cents (or whatever the smallest currency unit is).
--     ISO 4217 codes go in `currency`. No floats anywhere.
--   - Timestamps are stored as INTEGER milliseconds since epoch (Date.now()).
--     SQLite has no native datetime type and ms-int sorts/compares cleanly.
--   - JSON blobs are TEXT validated by application code (Zod schemas).
--   - Indexes are added with intent: every WHERE/ORDER BY in api/queries.ts
--     should hit one.

CREATE TABLE IF NOT EXISTS emails (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  gmail_message_id    TEXT    NOT NULL UNIQUE,
  gmail_thread_id     TEXT    NOT NULL,
  internal_date       INTEGER NOT NULL,
  from_address        TEXT    NOT NULL,
  from_name           TEXT,
  subject             TEXT,
  snippet             TEXT,
  body_text           TEXT,
  body_html           TEXT,
  raw_headers_json    TEXT,
  fetched_at          INTEGER NOT NULL,
  processed_at        INTEGER,
  processed_status    TEXT    NOT NULL DEFAULT 'pending'
                              CHECK (processed_status IN
                                ('pending','classified','done','error','skipped')),
  classification      TEXT,
  error_message       TEXT
);
CREATE INDEX IF NOT EXISTS idx_emails_status        ON emails(processed_status);
CREATE INDEX IF NOT EXISTS idx_emails_internal_date ON emails(internal_date DESC);
CREATE INDEX IF NOT EXISTS idx_emails_from          ON emails(from_address);

CREATE TABLE IF NOT EXISTS merchants (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_name  TEXT    NOT NULL UNIQUE,
  display_name    TEXT    NOT NULL,
  domain          TEXT,
  logo_url        TEXT,
  category        TEXT,
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_merchants_domain ON merchants(domain);

CREATE TABLE IF NOT EXISTS receipts (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id            INTEGER NOT NULL UNIQUE REFERENCES emails(id)    ON DELETE CASCADE,
  merchant_id         INTEGER NOT NULL        REFERENCES merchants(id) ON DELETE CASCADE,
  total_amount_cents  INTEGER NOT NULL,
  currency            TEXT    NOT NULL DEFAULT 'USD',
  transaction_date    INTEGER NOT NULL,
  line_items_json     TEXT,
  order_number        TEXT,
  payment_method      TEXT,
  confidence          REAL    NOT NULL DEFAULT 0,
  extraction_model    TEXT    NOT NULL,
  raw_extraction_json TEXT,
  created_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_receipts_merchant ON receipts(merchant_id);
CREATE INDEX IF NOT EXISTS idx_receipts_date     ON receipts(transaction_date DESC);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id          INTEGER NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  plan_name            TEXT,
  amount_cents         INTEGER NOT NULL,
  currency             TEXT    NOT NULL DEFAULT 'USD',
  billing_cycle        TEXT    NOT NULL DEFAULT 'unknown'
                                CHECK (billing_cycle IN
                                  ('weekly','monthly','quarterly','annually','unknown')),
  next_renewal_date    INTEGER,
  first_seen_email_id  INTEGER REFERENCES emails(id) ON DELETE SET NULL,
  last_seen_email_id   INTEGER REFERENCES emails(id) ON DELETE SET NULL,
  status               TEXT    NOT NULL DEFAULT 'unknown'
                                CHECK (status IN ('active','cancelled','trial','unknown')),
  trial_end_date       INTEGER,
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subs_merchant ON subscriptions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_subs_status   ON subscriptions(status);
-- Roughly-unique key so the dedupe pass is idempotent across syncs.
CREATE UNIQUE INDEX IF NOT EXISTS uq_subs_natural
  ON subscriptions(merchant_id, billing_cycle, amount_cents, currency);

CREATE TABLE IF NOT EXISTS subscription_charges (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  receipt_id      INTEGER          REFERENCES receipts(id)      ON DELETE SET NULL,
  charge_date     INTEGER NOT NULL,
  amount_cents    INTEGER NOT NULL,
  currency        TEXT    NOT NULL DEFAULT 'USD'
);
CREATE INDEX IF NOT EXISTS idx_charges_sub  ON subscription_charges(subscription_id);
CREATE INDEX IF NOT EXISTS idx_charges_date ON subscription_charges(charge_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_charges_receipt
  ON subscription_charges(receipt_id) WHERE receipt_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS alerts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT    NOT NULL
                        CHECK (type IN
                          ('trial_ending','price_increase','new_subscription','duplicate_charge')),
  subject_id    INTEGER NOT NULL,
  subject_table TEXT    NOT NULL,
  payload_json  TEXT    NOT NULL,
  created_at    INTEGER NOT NULL,
  dismissed_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_alerts_type    ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_subject ON alerts(subject_table, subject_id);
CREATE INDEX IF NOT EXISTS idx_alerts_open    ON alerts(dismissed_at) WHERE dismissed_at IS NULL;

CREATE TABLE IF NOT EXISTS sync_runs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at        INTEGER NOT NULL,
  finished_at       INTEGER,
  emails_fetched    INTEGER NOT NULL DEFAULT 0,
  emails_processed  INTEGER NOT NULL DEFAULT 0,
  errors_json       TEXT,
  status            TEXT    NOT NULL DEFAULT 'running'
                            CHECK (status IN ('running','finished','failed'))
);

CREATE TABLE IF NOT EXISTS classification_cache (
  hash       TEXT PRIMARY KEY,
  result     TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS merchant_alias_cache (
  raw_string  TEXT NOT NULL,
  from_domain TEXT NOT NULL,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (raw_string, from_domain)
);

CREATE TABLE IF NOT EXISTS kv (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS schema_version (
  version    INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
