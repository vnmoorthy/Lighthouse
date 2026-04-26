-- Tags. A many-to-many association between receipts and free-text tags.
--
-- We don't normalize tags into their own dimension table because a few
-- thousand free-text tags is well within SQLite's comfort zone, and
-- keeping them inline lets the user invent any tag without ceremony.
--
-- Queries that filter by tag use the (tag, receipt_id) covering index.

CREATE TABLE IF NOT EXISTS receipt_tags (
  receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  tag        TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (receipt_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_receipt_tags_tag ON receipt_tags(tag, receipt_id);
