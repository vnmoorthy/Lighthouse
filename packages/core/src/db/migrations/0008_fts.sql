-- Full-text search across email bodies.
--
-- Rather than ALTER the existing emails table (no FTS5 join out of the box),
-- we mirror the searchable columns into a contentless FTS5 virtual table
-- and keep it synced with triggers. This keeps the canonical row in
-- `emails` and the FTS index in `emails_fts`.
--
-- We only index subject + body_text + from_address + from_name. Body HTML
-- is too noisy for FTS; the plaintext we already extracted is what we
-- want.

CREATE VIRTUAL TABLE IF NOT EXISTS emails_fts USING fts5(
  subject,
  body_text,
  from_address,
  from_name,
  content='emails',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

-- Backfill from existing rows.
INSERT INTO emails_fts (rowid, subject, body_text, from_address, from_name)
  SELECT id, subject, body_text, from_address, from_name
  FROM emails
  WHERE NOT EXISTS (SELECT 1 FROM emails_fts WHERE rowid = emails.id);

-- Sync triggers.
CREATE TRIGGER IF NOT EXISTS emails_fts_ai AFTER INSERT ON emails BEGIN
  INSERT INTO emails_fts (rowid, subject, body_text, from_address, from_name)
    VALUES (new.id, new.subject, new.body_text, new.from_address, new.from_name);
END;
CREATE TRIGGER IF NOT EXISTS emails_fts_ad AFTER DELETE ON emails BEGIN
  INSERT INTO emails_fts (emails_fts, rowid, subject, body_text, from_address, from_name)
    VALUES ('delete', old.id, old.subject, old.body_text, old.from_address, old.from_name);
END;
CREATE TRIGGER IF NOT EXISTS emails_fts_au AFTER UPDATE ON emails BEGIN
  INSERT INTO emails_fts (emails_fts, rowid, subject, body_text, from_address, from_name)
    VALUES ('delete', old.id, old.subject, old.body_text, old.from_address, old.from_name);
  INSERT INTO emails_fts (rowid, subject, body_text, from_address, from_name)
    VALUES (new.id, new.subject, new.body_text, new.from_address, new.from_name);
END;
