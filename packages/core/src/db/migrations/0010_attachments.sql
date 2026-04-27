-- Receipt attachments (PDFs, photos, mbox excerpts).
--
-- We store the bytes inline in SQLite as BLOB, kept under a hard cap.
-- Justification: most receipts are <1 MB; the file system is right there
-- in `~/.lighthouse/lighthouse.db` and a single file is operationally
-- simpler than a separate `attachments/` directory. Anyone who wants
-- millions of multi-MB photos should use a separate object store; this
-- isn't that.

CREATE TABLE IF NOT EXISTS receipt_attachments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_id  INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  kind        TEXT    NOT NULL CHECK (kind IN ('photo','pdf','email_html','other')),
  filename    TEXT,
  media_type  TEXT,
  bytes       BLOB    NOT NULL,
  size_bytes  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attachments_receipt ON receipt_attachments(receipt_id);
