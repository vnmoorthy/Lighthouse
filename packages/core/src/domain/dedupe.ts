/**
 * Subscription dedupe + status pass.
 *
 * Run after the LLM pipeline finishes. The pipeline has produced
 * subscriptions with uq_subs_natural already enforced — but the *charges*
 * table needs cleanup (some renewal emails create receipts; some receipts
 * are quietly subscription charges; some plans change price and we want
 * to recompute next-renewal).
 *
 * What this does:
 *   1. For each existing subscription, find receipts from the same merchant
 *      whose total falls within ±5% of the subscription amount, attach them
 *      as charges (idempotent — uq_charges_receipt prevents dupes).
 *   2. Compute next_renewal_date from latest charge + cycle if not already
 *      set by a renewal email.
 *   3. Update status:
 *      - cancelled if a `subscription_cancellation` email exists more
 *        recently than any charge
 *      - active   if last charge within 1.5x cycle length
 *      - trial    if currently before trial_end_date
 *      - unknown  otherwise (no charges yet, no signal)
 */
import { getDb } from '../db/index.js';
import { listChargesForSubscription } from '../db/queries.js';
import type { SubscriptionRow } from './types.js';
import { cycleDays, relativeDiff } from './currency.js';
import { log } from '../logger.js';

const TOLERANCE = 0.05; // ±5%
const DAY = 24 * 60 * 60 * 1000;

export interface DedupeStats {
  subscriptions: number;
  attachedCharges: number;
  cancelled: number;
  activated: number;
  trial: number;
}

export function dedupeAndScoreSubscriptions(): DedupeStats {
  const db = getDb();
  const stats: DedupeStats = {
    subscriptions: 0,
    attachedCharges: 0,
    cancelled: 0,
    activated: 0,
    trial: 0,
  };

  const subs = db.prepare('SELECT * FROM subscriptions').all() as SubscriptionRow[];
  stats.subscriptions = subs.length;

  for (const sub of subs) {
    // 1. Attach receipts from the same merchant + close-enough amount.
    const candidates = db
      .prepare(
        `SELECT r.id, r.transaction_date, r.total_amount_cents, r.currency
         FROM receipts r
         WHERE r.merchant_id = ? AND r.currency = ?
         AND r.id NOT IN (
           SELECT receipt_id FROM subscription_charges WHERE receipt_id IS NOT NULL
         )`,
      )
      .all(sub.merchant_id, sub.currency) as {
      id: number;
      transaction_date: number;
      total_amount_cents: number;
      currency: string;
    }[];

    const insert = db.prepare(
      `INSERT INTO subscription_charges (subscription_id, receipt_id, charge_date, amount_cents, currency)
       VALUES (?,?,?,?,?)
       ON CONFLICT(receipt_id) WHERE receipt_id IS NOT NULL DO NOTHING`,
    );

    for (const c of candidates) {
      if (relativeDiff(c.total_amount_cents, sub.amount_cents) <= TOLERANCE) {
        const r = insert.run(sub.id, c.id, c.transaction_date, c.total_amount_cents, c.currency);
        if (r.changes > 0) stats.attachedCharges++;
      }
    }

    // 2. Compute next renewal from latest charge.
    const charges = listChargesForSubscription(sub.id);
    let nextRenewal: number | null = sub.next_renewal_date;
    if (charges.length > 0) {
      const latest = charges[0]!.charge_date;
      const days = cycleDays(sub.billing_cycle);
      const computed = latest + days * DAY;
      // If we already have a next_renewal_date that's in the future, keep it.
      // Otherwise update.
      if (!nextRenewal || nextRenewal < Date.now()) nextRenewal = computed;
    }

    // 3. Status.
    let newStatus: SubscriptionRow['status'] = sub.status;
    const merchantRow = db
      .prepare('SELECT domain FROM merchants WHERE id = ?')
      .get(sub.merchant_id) as { domain: string | null } | undefined;
    const since = charges.length > 0 ? charges[0]!.charge_date : 0;
    // Only run the cancellation lookup when we have a domain to match on —
    // otherwise the LIKE pattern would fall back to '%null%' and silently
    // mark random subs as cancelled.
    const cancelledRecently = merchantRow?.domain
      ? db
          .prepare(
            `SELECT 1 FROM emails
             WHERE classification = 'subscription_cancellation'
             AND from_address LIKE ?
             AND internal_date > ?`,
          )
          .get('%' + merchantRow.domain + '%', since)
      : null;

    if (cancelledRecently) {
      newStatus = 'cancelled';
      stats.cancelled++;
    } else if (sub.trial_end_date && sub.trial_end_date > Date.now()) {
      newStatus = 'trial';
      stats.trial++;
    } else if (charges.length > 0) {
      const latest = charges[0]!.charge_date;
      const cutoff = Date.now() - 1.5 * cycleDays(sub.billing_cycle) * DAY;
      newStatus = latest >= cutoff ? 'active' : 'unknown';
      if (newStatus === 'active') stats.activated++;
    }

    db.prepare(
      `UPDATE subscriptions SET next_renewal_date = ?, status = ?, updated_at = ? WHERE id = ?`,
    ).run(nextRenewal, newStatus, Date.now(), sub.id);
  }
  log.info(
    `Dedupe: ${stats.subscriptions} subs, +${stats.attachedCharges} charges, ` +
      `${stats.activated} active, ${stats.cancelled} cancelled, ${stats.trial} on trial.`,
  );
  return stats;
}
