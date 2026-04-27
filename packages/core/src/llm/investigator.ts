/**
 * Investigator agent. Takes a subscription_id and produces a short
 * markdown explanation of where the recurring charge came from:
 *
 *   - the nearest signup/welcome email (if any)
 *   - the typical billing cadence inferred from recent charges
 *   - any price changes we've seen
 *   - whether the user has likely used the service recently
 *
 * The agent gets a hand-picked set of email excerpts from the database
 * (we don't dump full bodies — keeps the prompt cheap and avoids leaking
 * unrelated context). The output is plain markdown; the dashboard
 * renders it in the subscription drawer.
 */
import { z } from 'zod';
import { runStructured } from './client.js';
import { getDb } from '../db/index.js';

const SYSTEM = `You are an investigator helping a Lighthouse user understand a recurring
charge they're seeing on their card.

You will be given:
  - the subscription's merchant + amount + cycle
  - up to 5 emails from that merchant: a "first seen" email, a recent
    receipt, plus anything that looks like a welcome / signup / trial
    confirmation
  - any price-change alerts that fired

Produce a short Markdown explanation (≤ 6 short bullets, plus a header)
that answers:
  - When did this start? Was it a free trial?
  - What's the typical cadence and price?
  - Has the price changed since signup?
  - Is there evidence the user has used the service recently?
  - What's the cheapest path to cancel? (Just say "use the cancel link
    on the subscription drawer" — that's already provided in the UI.)

Style:
  - Plain English. No hedging ("perhaps", "might be"). State facts.
  - If you don't have evidence for a question, say so explicitly.
  - Cap output at ~120 words. Brevity is the point.`;

const InvestigatorSchema = z.object({
  markdown: z.string(),
  confidence: z.number().min(0).max(1),
});

export interface InvestigatorEvidence {
  merchant: string;
  plan_name: string | null;
  amount_cents: number;
  currency: string;
  billing_cycle: string;
  excerpts: { subject: string | null; from: string; body_excerpt: string; internal_date: number; kind: string }[];
  charges: { amount_cents: number; charge_date: number }[];
}

export async function investigateSubscription(subId: number): Promise<{ markdown: string; confidence: number }> {
  const db = getDb();
  const sub = db
    .prepare(
      `SELECT s.*, m.display_name AS merchant_display_name, m.canonical_name, m.domain
       FROM subscriptions s JOIN merchants m ON m.id = s.merchant_id WHERE s.id = ?`,
    )
    .get(subId) as
    | {
        merchant_display_name: string;
        canonical_name: string;
        domain: string | null;
        plan_name: string | null;
        amount_cents: number;
        currency: string;
        billing_cycle: string;
        first_seen_email_id: number | null;
        last_seen_email_id: number | null;
      }
    | undefined;
  if (!sub) throw new Error('subscription not found');

  // Pull a curated set of emails — first-seen, last-seen, and anything
  // classified as signup/trial/price_change for this merchant's domain.
  const candidates: { id: number; subject: string | null; from_address: string; internal_date: number; classification: string | null; body_text: string | null }[] = [];
  const seen = new Set<number>();
  function add(id: number | null) {
    if (id == null || seen.has(id)) return;
    seen.add(id);
    const row = db
      .prepare(
        'SELECT id, subject, from_address, internal_date, classification, body_text FROM emails WHERE id = ?',
      )
      .get(id) as
      | { id: number; subject: string | null; from_address: string; internal_date: number; classification: string | null; body_text: string | null }
      | undefined;
    if (row) candidates.push(row);
  }
  add(sub.first_seen_email_id);
  add(sub.last_seen_email_id);
  // Find signup/trial/price_change emails by domain.
  if (sub.domain) {
    const more = db
      .prepare(
        `SELECT id, subject, from_address, internal_date, classification, body_text FROM emails
         WHERE classification IN ('subscription_signup','trial_started','trial_ending_soon','price_change')
         AND from_address LIKE ?
         ORDER BY internal_date ASC LIMIT 3`,
      )
      .all('%' + sub.domain + '%') as {
      id: number;
      subject: string | null;
      from_address: string;
      internal_date: number;
      classification: string | null;
      body_text: string | null;
    }[];
    for (const e of more) add(e.id);
  }

  const charges = db
    .prepare(
      'SELECT amount_cents, charge_date FROM subscription_charges WHERE subscription_id = ? ORDER BY charge_date DESC LIMIT 6',
    )
    .all(subId) as { amount_cents: number; charge_date: number }[];

  const evidence: InvestigatorEvidence = {
    merchant: sub.merchant_display_name,
    plan_name: sub.plan_name,
    amount_cents: sub.amount_cents,
    currency: sub.currency,
    billing_cycle: sub.billing_cycle,
    excerpts: candidates.map((c) => ({
      subject: c.subject,
      from: c.from_address,
      kind: c.classification ?? 'email',
      internal_date: c.internal_date,
      body_excerpt: (c.body_text ?? '').slice(0, 800),
    })),
    charges,
  };

  const userPrompt = JSON.stringify(evidence, null, 2);

  const { data } = await runStructured({
    system: SYSTEM,
    user: userPrompt,
    schema: InvestigatorSchema,
    toolName: 'explain_subscription',
    toolDescription: 'Return a short markdown explanation of where a recurring charge came from.',
    timeoutMs: 30_000,
  });
  return data;
}
