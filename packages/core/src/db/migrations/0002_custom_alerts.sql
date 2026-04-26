-- Custom alert rules.
--
-- Each row defines a user-supplied watch: "tell me when X". The engine
-- evaluates rules at the end of every sync and creates rows in `alerts`
-- when a rule fires (with the same 30-day suppression window as built-in
-- alerts).
--
-- Rule types:
--   merchant_threshold:
--     payload = { merchant_id, max_cents, window_days }
--     Fires when SUM of receipts at merchant_id over the trailing
--     window_days is > max_cents.
--   category_threshold:
--     payload = { category, max_cents, window_days }
--     Fires when SUM of receipts in category over the trailing
--     window_days is > max_cents.
--   any_charge:
--     payload = { merchant_id, min_cents }
--     Fires on any single charge at merchant_id ≥ min_cents.
--
-- We keep this generic: extending requires adding a new `type` and an
-- `eval` clause in domain/custom_alerts.ts, no schema change.

CREATE TABLE IF NOT EXISTS custom_alert_rules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  type        TEXT    NOT NULL
                      CHECK (type IN ('merchant_threshold','category_threshold','any_charge')),
  payload_json TEXT    NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  last_fired_at INTEGER
);

-- Custom alerts use the existing `alerts` table; we add a new type so
-- the dashboard can colour them differently. We also expand the type
-- check so the table accepts the new value.

-- SQLite doesn't support ALTER COLUMN to relax a CHECK constraint; the
-- canonical workaround is to recreate the table. To keep the migration
-- short we simply re-create alerts with the wider check, copying data.
CREATE TABLE IF NOT EXISTS alerts__new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT    NOT NULL
                        CHECK (type IN
                          ('trial_ending','price_increase','new_subscription','duplicate_charge','custom')),
  subject_id    INTEGER NOT NULL,
  subject_table TEXT    NOT NULL,
  payload_json  TEXT    NOT NULL,
  created_at    INTEGER NOT NULL,
  dismissed_at  INTEGER
);
INSERT INTO alerts__new (id, type, subject_id, subject_table, payload_json, created_at, dismissed_at)
  SELECT id, type, subject_id, subject_table, payload_json, created_at, dismissed_at FROM alerts;
DROP TABLE alerts;
ALTER TABLE alerts__new RENAME TO alerts;
CREATE INDEX IF NOT EXISTS idx_alerts_type    ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_subject ON alerts(subject_table, subject_id);
CREATE INDEX IF NOT EXISTS idx_alerts_open    ON alerts(dismissed_at) WHERE dismissed_at IS NULL;
