/**
 * Synchronous ingest path for a single forwarded email.
 *
 * Used by /api/ingest/email so non-Gmail users can send a single email
 * (via a mail filter, Apple Shortcut, or just a curl) and get it
 * extracted immediately. The function reuses the same classifier +
 * extractors as the bulk pipeline.
 */
import { createHash } from 'node:crypto';
import {
  insertEmail,
  markEmailDone,
  markEmailError,
  markEmailSkipped,
  insertReceipt,
  upsertSubscription,
  insertSubscriptionCharge,
  markEmailClassified,
} from '../db/index.js';
import type { EmailRow } from '../domain/types.js';
import { classifyEmail } from '../llm/extractors/classifier.js';
import { extractReceipt } from '../llm/extractors/receipt.js';
import { extractSubscription } from '../llm/extractors/subscription.js';
import { resolveMerchant } from '../domain/normalize.js';
import { htmlToText, parseFrom } from '../gmail/parse.js';
import { log } from '../logger.js';

export interface IngestInput {
  from: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  internal_date: number;
}

export interface IngestResult {
  email_id: number | null;
  classification: string;
  receipt_id?: number;
  subscription_id?: number;
  error?: string;
}

function ymdToMs(s: string): number {
  const m = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(s);
  if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : Date.now();
}

export async function ingestForwardedEmail(input: IngestInput): Promise<IngestResult> {
  // Normalize.
  const parsed = parseFrom(input.from);
  const fromAddr = parsed.address || input.from.toLowerCase();
  const fromName = parsed.name;
  const bodyText = input.body_text || (input.body_html ? htmlToText(input.body_html) : null);

  // Synthesise a stable Gmail-like message id (so re-posting the same
  // email is idempotent at the SQL level).
  const sig = createHash('sha256')
    .update(fromAddr)
    .update('\0')
    .update(input.subject ?? '')
    .update('\0')
    .update(String(input.internal_date))
    .update('\0')
    .update(bodyText?.slice(0, 1000) ?? '')
    .digest('hex')
    .slice(0, 24);

  const newId = insertEmail({
    gmail_message_id: 'forwarded-' + sig,
    gmail_thread_id: 'forwarded-' + sig,
    internal_date: input.internal_date,
    from_address: fromAddr,
    from_name: fromName,
    subject: input.subject,
    snippet: (bodyText ?? '').slice(0, 200),
    body_text: bodyText,
    body_html: input.body_html,
    raw_headers_json: null,
    fetched_at: Date.now(),
  });

  if (newId == null) {
    return { email_id: null, classification: 'duplicate' };
  }

  const e: EmailRow = {
    id: newId,
    gmail_message_id: 'forwarded-' + sig,
    gmail_thread_id: 'forwarded-' + sig,
    internal_date: input.internal_date,
    from_address: fromAddr,
    from_name: fromName,
    subject: input.subject,
    snippet: (bodyText ?? '').slice(0, 200),
    body_text: bodyText,
    body_html: input.body_html,
    raw_headers_json: null,
    fetched_at: Date.now(),
    processed_at: null,
    processed_status: 'pending',
    classification: null,
    error_message: null,
  };

  let classification: string;
  try {
    classification = await classifyEmail(e);
  } catch (err) {
    markEmailError(newId, `classify: ${(err as Error).message}`);
    return { email_id: newId, classification: 'error', error: (err as Error).message };
  }
  markEmailClassified(newId, classification as never);

  if (classification === 'not_relevant' || classification === 'shipping_notification') {
    markEmailSkipped(newId, classification);
    return { email_id: newId, classification };
  }

  const out: IngestResult = { email_id: newId, classification };

  if (classification === 'receipt' || classification === 'refund' || classification === 'subscription_renewal') {
    try {
      const r = await extractReceipt(e);
      if (r.extraction.is_receipt) {
        const merchant = await resolveMerchant(r.extraction.merchant_name, fromAddr);
        const signed =
          classification === 'refund' && r.extraction.total_amount_cents > 0
            ? -r.extraction.total_amount_cents
            : r.extraction.total_amount_cents;
        const id = insertReceipt({
          email_id: newId,
          merchant_id: merchant.id,
          total_amount_cents: signed,
          currency: r.extraction.currency || 'USD',
          transaction_date: ymdToMs(r.extraction.transaction_date),
          line_items_json: r.extraction.line_items
            ? JSON.stringify(r.extraction.line_items)
            : null,
          order_number: r.extraction.order_number,
          payment_method: r.extraction.payment_method,
          confidence: r.extraction.confidence,
          extraction_model: r.model,
          raw_extraction_json: JSON.stringify(r.extraction),
        });
        out.receipt_id = id;
      }
    } catch (err) {
      markEmailError(newId, `receipt: ${(err as Error).message}`);
      out.error = (err as Error).message;
      return out;
    }
  }

  if (
    classification === 'subscription_signup' ||
    classification === 'subscription_renewal' ||
    classification === 'subscription_cancellation' ||
    classification === 'trial_started' ||
    classification === 'trial_ending_soon' ||
    classification === 'price_change'
  ) {
    try {
      const s = await extractSubscription(e);
      if (s.extraction.is_subscription && s.extraction.amount_cents > 0) {
        const merchant = await resolveMerchant(s.extraction.merchant_name, fromAddr);
        const subId = upsertSubscription({
          merchant_id: merchant.id,
          plan_name: s.extraction.plan_name,
          amount_cents: s.extraction.amount_cents,
          currency: s.extraction.currency || 'USD',
          billing_cycle: s.extraction.billing_cycle,
          status:
            s.extraction.action === 'cancellation'
              ? 'cancelled'
              : classification === 'trial_started' || s.extraction.action === 'trial'
                ? 'trial'
                : 'active',
          last_seen_email_id: newId,
          first_seen_email_id: newId,
          next_renewal_date: s.extraction.next_renewal_date
            ? ymdToMs(s.extraction.next_renewal_date)
            : null,
          trial_end_date: s.extraction.trial_end_date
            ? ymdToMs(s.extraction.trial_end_date)
            : null,
        });
        out.subscription_id = subId;

        if (out.receipt_id) {
          insertSubscriptionCharge({
            subscription_id: subId,
            receipt_id: out.receipt_id,
            charge_date: ymdToMs(s.extraction.next_renewal_date ?? new Date().toISOString().slice(0, 10)),
            amount_cents: s.extraction.amount_cents,
            currency: s.extraction.currency || 'USD',
          });
        }
      }
    } catch (err) {
      log.warn(`forwarded subscription extract failed: ${(err as Error).message}`);
    }
  }

  markEmailDone(newId);
  return out;
}
