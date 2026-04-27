/**
 * Photo-OCR ingest path.
 *
 * Takes a `ReceiptResult` produced by the vision extractor, normalizes
 * the merchant, writes a synthetic email row + receipt row. The synthetic
 * email body contains the extraction notes so the dashboard's "show me
 * the proof" view still has something useful.
 */
import { createHash } from 'node:crypto';
import { insertEmail, insertReceipt, markEmailDone } from '../db/index.js';
import { resolveMerchant } from '../domain/normalize.js';
import type { ReceiptResult } from '../llm/extractors/receipt.js';

function ymdToMs(s: string): number {
  const m = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(s);
  if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : Date.now();
}

export async function ingestPhotoReceipt(
  r: ReceiptResult,
): Promise<{ email_id: number | null; receipt_id?: number; classification: string }> {
  if (!r.extraction.is_receipt) {
    return { email_id: null, classification: 'not_receipt' };
  }
  const sig = createHash('sha256')
    .update('photo')
    .update('\0')
    .update(r.extraction.merchant_name)
    .update('\0')
    .update(String(r.extraction.total_amount_cents))
    .update('\0')
    .update(r.extraction.transaction_date)
    .digest('hex')
    .slice(0, 24);

  const fakeFrom = `photo-receipt@${sig}.local`;
  const body = `Photo receipt — extracted by vision LLM.

Merchant: ${r.extraction.merchant_name}
Total:    ${r.extraction.total_amount_cents / 100} ${r.extraction.currency}
Date:     ${r.extraction.transaction_date}
Order #:  ${r.extraction.order_number ?? '-'}
Payment:  ${r.extraction.payment_method ?? '-'}

Notes from the model: ${r.extraction.notes ?? '-'}`;

  const emailId = insertEmail({
    gmail_message_id: 'photo-' + sig,
    gmail_thread_id: 'photo-' + sig,
    internal_date: ymdToMs(r.extraction.transaction_date),
    from_address: fakeFrom,
    from_name: r.extraction.merchant_name,
    subject: `Receipt — ${r.extraction.merchant_name}`,
    snippet: `Photo receipt · ${r.extraction.merchant_name} · ${r.extraction.transaction_date}`,
    body_text: body,
    body_html: null,
    raw_headers_json: null,
    fetched_at: Date.now(),
  });
  if (emailId == null) return { email_id: null, classification: 'duplicate' };

  const merchant = await resolveMerchant(r.extraction.merchant_name, fakeFrom);
  const receiptId = insertReceipt({
    email_id: emailId,
    merchant_id: merchant.id,
    total_amount_cents: r.extraction.total_amount_cents,
    currency: r.extraction.currency || 'USD',
    transaction_date: ymdToMs(r.extraction.transaction_date),
    line_items_json: r.extraction.line_items
      ? JSON.stringify(r.extraction.line_items)
      : null,
    order_number: r.extraction.order_number,
    payment_method: r.extraction.payment_method,
    confidence: r.extraction.confidence,
    extraction_model: r.model + ' (vision)',
    raw_extraction_json: JSON.stringify(r.extraction),
  });
  markEmailDone(emailId);
  return { email_id: emailId, receipt_id: receiptId, classification: 'photo_receipt' };
}
