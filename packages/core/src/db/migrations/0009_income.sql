-- Income tracking.
--
-- Lighthouse can now ingest "money in" events alongside the receipts
-- (money out) it derives from your inbox. Income comes from emails too
-- (paystubs, payment notifications, "you've been paid" messages from
-- platforms), but extraction is brittle — much more variation than
-- receipts. So v0.39 ships *manual* income entry and the math layer.
-- A future release will add an LLM extractor for paystub-style emails.

CREATE TABLE IF NOT EXISTS income (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source        TEXT    NOT NULL,
  amount_cents  INTEGER NOT NULL,
  currency      TEXT    NOT NULL DEFAULT 'USD',
  received_at   INTEGER NOT NULL,
  recurring     INTEGER NOT NULL DEFAULT 0,
  cycle         TEXT    CHECK (cycle IS NULL OR cycle IN ('weekly','biweekly','monthly','quarterly','annually')),
  note          TEXT,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_income_received_at ON income(received_at DESC);
