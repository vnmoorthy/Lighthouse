/**
 * Alerts engine.
 *
 * Runs at the tail of every sync. Produces four kinds of alerts:
 *
 *   - trial_ending: a subscription with status=trial and trial_end_date in
 *     the next 7 days.
 *   - price_increase: a charge whose amount differs from the prior 3 charges
 *     of the same subscription by more than 5%.
 *   - new_subscription: a subscription created since the last sync run.
 *   - duplicate_charge: two receipts from the same merchant within 24h with
 *     similar amounts.
 *
 * `insertAlert()` already enforces the "don't recreate within 30d" rule.
 */
import { getDb } from '../db/index.js';
import {
  insertAlert,
  listSubscriptions,
  listChargesForSubscription,
  getLatestSyncRun,
} from '../db/queries.js';
import { relativeDiff } from './currency.js';
import { log } from '../logger.js';

const DAY = 24 * 60 * 60 * 1000;

export interface AlertStats {
  trial_ending: number;
  price_increase: number;
  new_subscription: number;
  duplicate_charge: number;
}

export function runAlertsPass(): AlertStats {
  const stats: AlertStats = {
    trial_ending: 0,
    price_increase: 0,
    new_subscription: 0,
    duplicate_charge: 0,
  };

  const now = Date.now();
  const lastSync = getLatestSyncRun();
  const lastSyncStart = lastSync?.started_at ?? 0;

  // --- Trial ending in next 7d -------------------------------------------
  const trialing = listSubscriptions('trial');
  for (const s of trialing) {
    if (!s.trial_end_date) continue;
    const daysOut = Math.floor((s.trial_end_date - now) / DAY);
    if (daysOut >= 0 && daysOut <= 7) {
      const made = insertAlert({
        type: 'trial_ending',
        subject_id: s.id,
        subject_table: 'subscriptions',
        payload: {
          merchant: s.merchant_display_name,
          plan_name: s.plan_name,
          trial_end_date: s.trial_end_date,
          days_until_end: daysOut,
          amount_cents: s.amount_cents,
          currency: s.currency,
        },
      });
      if (made) stats.trial_ending++;
    }
  }

  // --- Price increase: latest charge differs from prior 3 by >5% ----------
  for (const s of listSubscriptions('active')) {
    const charges = listChargesForSubscription(s.id);
    if (charges.length < 4) continue;
    const [latest, ...rest] = charges;
    const prior3 = rest.slice(0, 3);
    const avg = prior3.reduce((acc, c) => acc + c.amount_cents, 0) / prior3.length;
    if (relativeDiff(latest!.amount_cents, avg) > 0.05) {
      const direction = latest!.amount_cents > avg ? 'increase' : 'decrease';
      const made = insertAlert({
        type: 'price_increase',
        subject_id: s.id,
        subject_table: 'subscriptions',
        payload: {
          merchant: s.merchant_display_name,
          plan_name: s.plan_name,
          old_amount_cents: Math.round(avg),
          new_amount_cents: latest!.amount_cents,
          currency: s.currency,
          direction,
          observed_on: latest!.charge_date,
        },
      });
      if (made) stats.price_increase++;
    }
  }

  // --- New subscriptions since last sync ---------------------------------
  if (lastSyncStart > 0) {
    const fresh = getDb()
      .prepare(
        `SELECT s.*, m.display_name as merchant_display_name
         FROM subscriptions s JOIN merchants m ON m.id = s.merchant_id
         WHERE s.created_at >= ?`,
      )
      .all(lastSyncStart) as { id: number; merchant_display_name: string; amount_cents: number;
        currency: string; billing_cycle: string; plan_name: string | null }[];
    for (const s of fresh) {
      const made = insertAlert({
        type: 'new_subscription',
        subject_id: s.id,
        subject_table: 'subscriptions',
        payload: {
          merchant: s.merchant_display_name,
          plan_name: s.plan_name,
          amount_cents: s.amount_cents,
          currency: s.currency,
          billing_cycle: s.billing_cycle,
        },
      });
      if (made) stats.new_subscription++;
    }
  }

  // --- Duplicate charge: 2 receipts same merchant in 24h, within 5% ------
  const dupCandidates = getDb()
    .prepare(
      `SELECT r1.id as id1, r2.id as id2, r1.merchant_id, r1.total_amount_cents as a1,
              r2.total_amount_cents as a2, r1.transaction_date as t1, r2.transaction_date as t2,
              m.display_name as merchant_display_name, r1.currency
       FROM receipts r1
       JOIN receipts r2 ON r1.merchant_id = r2.merchant_id AND r2.id > r1.id
       JOIN merchants m ON m.id = r1.merchant_id
       WHERE ABS(r1.transaction_date - r2.transaction_date) <= ?
       AND r1.currency = r2.currency`,
    )
    .all(DAY) as {
    id1: number;
    id2: number;
    merchant_id: number;
    a1: number;
    a2: number;
    t1: number;
    t2: number;
    merchant_display_name: string;
    currency: string;
  }[];

  for (const d of dupCandidates) {
    if (relativeDiff(d.a1, d.a2) > 0.05) continue;
    const made = insertAlert({
      type: 'duplicate_charge',
      subject_id: d.id2, // newer one
      subject_table: 'receipts',
      payload: {
        merchant: d.merchant_display_name,
        receipt_a: { id: d.id1, amount_cents: d.a1, date: d.t1 },
        receipt_b: { id: d.id2, amount_cents: d.a2, date: d.t2 },
        currency: d.currency,
      },
    });
    if (made) stats.duplicate_charge++;
  }

  log.info(
    `Alerts: trial=${stats.trial_ending} price=${stats.price_increase} ` +
      `new=${stats.new_subscription} dup=${stats.duplicate_charge}`,
  );
  return stats;
}
