/**
 * Processing pipeline.
 *
 * Reads `emails` rows where processed_status='pending', classifies them,
 * runs the appropriate Stage-2/Stage-3 extractor, normalizes the merchant,
 * and writes the resulting receipt / subscription rows. Orchestrates
 * concurrency, retries, and progress reporting.
 *
 * This is intentionally split from `gmail/fetch.ts` so that:
 *   1. You can run the pipeline against demo / Takeout-imported emails
 *      without ever talking to Gmail.
 *   2. You can re-run the pipeline (after improving prompts) without
 *      re-fetching the inbox.
 */
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import { config } from '../config.js';
import {
  countEmailsByStatus,
  getPendingEmails,
  insertReceipt,
  insertSubscriptionCharge,
  markEmailClassified,
  markEmailDone,
  markEmailError,
  markEmailSkipped,
  upsertSubscription,
} from '../db/queries.js';
import { classifyEmail } from '../llm/extractors/classifier.js';
import { extractReceipt } from '../llm/extractors/receipt.js';
import { extractSubscription } from '../llm/extractors/subscription.js';
import { resolveMerchant } from '../domain/normalize.js';
import { dedupeAndScoreSubscriptions } from '../domain/dedupe.js';
import { runAlertsPass } from '../domain/alerts.js';
import { log } from '../logger.js';
import type {
  EmailRow,
  EmailClass,
  BillingCycle,
  SubscriptionStatus,
} from '../domain/types.js';

const SUBSCRIPTION_CLASSES: EmailClass[] = [
  'subscription_signup',
  'subscription_renewal',
  'subscription_cancellation',
  'trial_started',
  'trial_ending_soon',
  'price_change',
];

export interface PipelineStats {
  pending: number;
  classified: number;
  receipts: number;
  subscriptions: number;
  charges: number;
  skipped: number;
  errors: number;
}

function ymdToMs(s: string): number {
  // Accepts YYYY-MM-DD or YYYY/MM/DD; falls back to Date.parse.
  const m = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(s);
  if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : Date.now();
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let last: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const wait = 750 * Math.pow(2, i) + Math.floor(Math.random() * 250);
      log.warn(`${label} attempt ${i + 1} failed: ${(e as Error).message}; retry in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last;
}

async function processOne(e: EmailRow, stats: PipelineStats): Promise<void> {
  // Stage 1 — classify.
  let cls: EmailClass;
  try {
    cls = await withRetry(() => classifyEmail(e), `classify(${e.id})`);
    stats.classified++;
  } catch (err) {
    markEmailError(e.id, `classify: ${(err as Error).message}`);
    stats.errors++;
    return;
  }
  markEmailClassified(e.id, cls);

  if (cls === 'not_relevant' || cls === 'shipping_notification') {
    markEmailSkipped(e.id, cls);
    stats.skipped++;
    return;
  }

  // Stage 2 — receipts. We extract receipts on both `receipt` and
  // `subscription_renewal` since renewal emails *are* receipts.
  if (cls === 'receipt' || cls === 'subscription_renewal') {
    try {
      const r = await withRetry(() => extractReceipt(e), `receipt(${e.id})`);
      if (!r.extraction.is_receipt) {
        markEmailSkipped(e.id, 'extractor returned is_receipt=false');
        stats.skipped++;
      } else {
        const merchant = await resolveMerchant(r.extraction.merchant_name, e.from_address);
        const receiptId = insertReceipt({
          email_id: e.id,
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
          extraction_model: r.model,
          raw_extraction_json: JSON.stringify(r.extraction),
        });
        stats.receipts++;
        // If this was classified as a renewal, *also* try to fold it into a
        // subscription. We run the lightweight subscription extractor on
        // the same email body — cheap, since classifier already cached it.
        if (cls === 'subscription_renewal') {
          try {
            const s = await withRetry(
              () => extractSubscription(e),
              `subscription(${e.id})`,
            );
            if (s.extraction.is_subscription && s.extraction.amount_cents > 0) {
              const subId = upsertSubscription({
                merchant_id: merchant.id,
                plan_name: s.extraction.plan_name,
                amount_cents: s.extraction.amount_cents,
                currency: s.extraction.currency || 'USD',
                billing_cycle: s.extraction.billing_cycle as BillingCycle,
                status: 'active',
                last_seen_email_id: e.id,
                first_seen_email_id: e.id,
                next_renewal_date: s.extraction.next_renewal_date
                  ? ymdToMs(s.extraction.next_renewal_date)
                  : null,
              });
              const chargeId = insertSubscriptionCharge({
                subscription_id: subId,
                receipt_id: receiptId,
                charge_date: ymdToMs(r.extraction.transaction_date),
                amount_cents: r.extraction.total_amount_cents,
                currency: r.extraction.currency || 'USD',
              });
              if (chargeId) stats.charges++;
              stats.subscriptions++;
            }
          } catch (err) {
            // Receipt insert already succeeded; this email is still useful.
            log.debug(
              `subscription extract failed for renewal ${e.id}: ${(err as Error).message}`,
            );
          }
        }
      }
    } catch (err) {
      markEmailError(e.id, `receipt: ${(err as Error).message}`);
      stats.errors++;
      return;
    }
    markEmailDone(e.id);
    return;
  }

  // Stage 3 — pure subscription event (signup, trial, cancel, price_change).
  if (SUBSCRIPTION_CLASSES.includes(cls)) {
    try {
      const s = await withRetry(() => extractSubscription(e), `subscription(${e.id})`);
      if (!s.extraction.is_subscription) {
        markEmailSkipped(e.id, 'extractor returned is_subscription=false');
        stats.skipped++;
      } else {
        const merchant = await resolveMerchant(s.extraction.merchant_name, e.from_address);
        const action = s.extraction.action;
        const status: SubscriptionStatus =
          action === 'cancellation'
            ? 'cancelled'
            : action === 'trial' || cls === 'trial_started'
              ? 'trial'
              : 'active';
        upsertSubscription({
          merchant_id: merchant.id,
          plan_name: s.extraction.plan_name,
          amount_cents: s.extraction.amount_cents,
          currency: s.extraction.currency || 'USD',
          billing_cycle: s.extraction.billing_cycle as BillingCycle,
          status,
          last_seen_email_id: e.id,
          first_seen_email_id: e.id,
          next_renewal_date: s.extraction.next_renewal_date
            ? ymdToMs(s.extraction.next_renewal_date)
            : null,
          trial_end_date: s.extraction.trial_end_date
            ? ymdToMs(s.extraction.trial_end_date)
            : null,
        });
        stats.subscriptions++;
      }
    } catch (err) {
      markEmailError(e.id, `subscription: ${(err as Error).message}`);
      stats.errors++;
      return;
    }
    markEmailDone(e.id);
    return;
  }

  // Shouldn't reach here — exhaustive switch on EmailClass.
  markEmailSkipped(e.id, `unhandled class: ${cls}`);
  stats.skipped++;
}

/** Drain pending emails through the pipeline until the queue is empty. */
export async function runPipeline(opts: { batchSize?: number } = {}): Promise<PipelineStats> {
  const batchSize = opts.batchSize ?? 200;
  const stats: PipelineStats = {
    pending: 0,
    classified: 0,
    receipts: 0,
    subscriptions: 0,
    charges: 0,
    skipped: 0,
    errors: 0,
  };

  const initialPending = countEmailsByStatus().pending;
  if (initialPending === 0) {
    log.info('No pending emails. Pipeline is idle.');
    return stats;
  }

  log.info(`Pipeline: ${initialPending} pending emails (concurrency ${config.llm.concurrency}).`);
  const bar = new cliProgress.SingleBar(
    {
      format: '  pipe  | {bar} | {value}/{total} ({percentage}%) | rcpts:{r} subs:{s} skp:{x} err:{e}',
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic,
  );
  bar.start(initialPending, 0, { r: 0, s: 0, x: 0, e: 0 });

  const limiter = pLimit(config.llm.concurrency);

  for (;;) {
    const batch = getPendingEmails(batchSize);
    if (batch.length === 0) break;
    stats.pending += batch.length;
    await Promise.all(
      batch.map((e) =>
        limiter(async () => {
          await processOne(e, stats);
          bar.increment(1, {
            r: stats.receipts,
            s: stats.subscriptions,
            x: stats.skipped,
            e: stats.errors,
          });
        }),
      ),
    );
  }
  bar.stop();

  log.info(
    `Pipeline done. classified=${stats.classified} receipts=${stats.receipts} ` +
      `subscriptions=${stats.subscriptions} charges=${stats.charges} ` +
      `skipped=${stats.skipped} errors=${stats.errors}`,
  );
  return stats;
}

/** Convenience: run dedupe + alerts as a single post-step. */
export function runPostProcessing(): void {
  dedupeAndScoreSubscriptions();
  runAlertsPass();
}
