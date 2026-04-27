/**
 * Receipt attachment queries.
 *
 * Hard size cap so a runaway upload doesn't blow up the DB. 5 MB feels
 * generous for a receipt scan; users with bigger files should use the
 * regular file system.
 */
import { getDb } from './index.js';

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export type AttachmentKind = 'photo' | 'pdf' | 'email_html' | 'other';

export interface AttachmentRow {
  id: number;
  receipt_id: number;
  kind: AttachmentKind;
  filename: string | null;
  media_type: string | null;
  size_bytes: number;
  created_at: number;
}

export function listAttachmentsForReceipt(receiptId: number): AttachmentRow[] {
  return getDb()
    .prepare(
      `SELECT id, receipt_id, kind, filename, media_type, size_bytes, created_at
       FROM receipt_attachments WHERE receipt_id = ? ORDER BY created_at`,
    )
    .all(receiptId) as AttachmentRow[];
}

export function getAttachmentBytes(id: number): { row: AttachmentRow; bytes: Buffer } | null {
  const row = getDb()
    .prepare(
      `SELECT id, receipt_id, kind, filename, media_type, bytes, size_bytes, created_at
       FROM receipt_attachments WHERE id = ?`,
    )
    .get(id) as
    | (AttachmentRow & { bytes: Buffer })
    | undefined;
  if (!row) return null;
  const { bytes, ...meta } = row;
  return { row: meta, bytes };
}

export function addAttachment(input: {
  receipt_id: number;
  kind: AttachmentKind;
  filename: string | null;
  media_type: string | null;
  bytes: Buffer;
}): AttachmentRow {
  if (input.bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new Error(`Attachment exceeds size limit (${MAX_ATTACHMENT_BYTES} bytes)`);
  }
  const r = getDb()
    .prepare(
      `INSERT INTO receipt_attachments
        (receipt_id, kind, filename, media_type, bytes, size_bytes, created_at)
       VALUES (?,?,?,?,?,?,?)`,
    )
    .run(
      input.receipt_id,
      input.kind,
      input.filename,
      input.media_type,
      input.bytes,
      input.bytes.byteLength,
      Date.now(),
    );
  return getDb()
    .prepare(
      `SELECT id, receipt_id, kind, filename, media_type, size_bytes, created_at
       FROM receipt_attachments WHERE id = ?`,
    )
    .get(Number(r.lastInsertRowid)) as AttachmentRow;
}

export function deleteAttachment(id: number): void {
  getDb().prepare('DELETE FROM receipt_attachments WHERE id = ?').run(id);
}
