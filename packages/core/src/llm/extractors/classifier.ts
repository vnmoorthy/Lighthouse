/**
 * Email classifier.
 *
 * Stage 1 of the pipeline. Cheap, fast, single-shot. We deliberately give
 * the model only the lightweight signals (from, subject, snippet, first 500
 * chars of body) — we *don't* feed it the full body. The output category
 * decides whether the next, more expensive extractor is worth running.
 */
import { createHash } from 'node:crypto';
import { z, runStructured } from '../client.js';
import type { EmailRow, EmailClass } from '../../domain/types.js';
import {
  getClassificationCache,
  putClassificationCache,
} from '../../db/queries.js';
import { log } from '../../logger.js';

const CLASSIFY_SYSTEM = `You are an email classifier for a personal-finance app called Lighthouse.

Your job: read a single email's metadata + opening text and decide which of
nine buckets it belongs to. Be conservative — when in doubt, choose
"not_relevant". Specifically:

- receipt: a one-time purchase confirmation. Common signals: "thanks for
  your order", "your receipt", "payment received", an order number, a total
  amount. Includes Amazon, Apple, Etsy, food delivery, ride-share.
- subscription_signup: confirmation that the user *just started* a recurring
  service. Often "welcome" or "your subscription has started".
- subscription_renewal: a recurring charge has been processed. Usually
  monthly/annual. May include "your monthly invoice" or "renewed" wording.
- subscription_cancellation: user has cancelled a subscription.
- trial_started: a free trial has just begun.
- trial_ending_soon: a free trial will end soon and convert to paid.
- price_change: a subscription's price is going up or down.
- shipping_notification: a "your order has shipped" email — NOT a receipt.
- not_relevant: anything else (newsletters, marketing, password resets,
  account alerts, social notifications, calendar invites, personal mail).

Important:
- Marketing emails advertising a sale are NOT receipts.
- "Your weekly digest" / "Recommendations for you" → not_relevant.
- 2FA codes, password resets, security alerts → not_relevant.
- Refund/return notifications without a receipt total → not_relevant.
- If a single email is BOTH a renewal and a price change, prefer price_change
  (the price-change branch produces a more informative alert).`;

const ClassifySchema = z.object({
  classification: z.enum([
    'receipt',
    'subscription_signup',
    'subscription_renewal',
    'subscription_cancellation',
    'trial_started',
    'trial_ending_soon',
    'price_change',
    'shipping_notification',
    'not_relevant',
  ]),
  reason: z.string(),
});

function cacheKey(e: Pick<EmailRow, 'from_address' | 'subject' | 'snippet'>): string {
  const h = createHash('sha256');
  h.update(`${e.from_address}\0${e.subject ?? ''}\0${e.snippet ?? ''}`);
  return h.digest('hex');
}

function buildUser(e: EmailRow): string {
  const head = (e.body_text ?? '').slice(0, 500).replace(/\s+/g, ' ').trim();
  return `From: ${e.from_name ? `"${e.from_name}" ` : ''}<${e.from_address}>
Subject: ${e.subject ?? '(no subject)'}
Snippet: ${e.snippet ?? ''}
Body excerpt: ${head}`;
}

export async function classifyEmail(e: EmailRow): Promise<EmailClass> {
  const ck = cacheKey(e);
  const cached = getClassificationCache(ck);
  if (cached) return cached;

  const { data, usage } = await runStructured({
    system: CLASSIFY_SYSTEM,
    user: buildUser(e),
    schema: ClassifySchema,
    toolName: 'classify_email',
    toolDescription: 'Return the classification of the given email.',
    timeoutMs: 30_000,
  });
  log.debug(
    `classify ${e.id} → ${data.classification} (in:${usage.inputTokens}/out:${usage.outputTokens})`,
  );
  putClassificationCache(ck, data.classification);
  return data.classification;
}
