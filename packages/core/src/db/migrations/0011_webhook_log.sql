-- Webhook delivery log + retry queue.
--
-- Every dispatch is logged. Pending entries are picked up by the retry
-- worker, which exponentially backs off until success or `attempts >= 3`.
-- Successful entries stay around for the Settings page's "delivery log"
-- view; we GC anything older than 30 days at write time.

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  url             TEXT    NOT NULL,
  payload_json    TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','success','failed')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_status_code INTEGER,
  last_error      TEXT,
  next_attempt_at INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_webhook_pending
  ON webhook_deliveries(status, next_attempt_at)
  WHERE status = 'pending';
