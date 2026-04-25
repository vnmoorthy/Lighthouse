/**
 * Subscription extractor — Stage 3.
 *
 * Runs on emails the classifier flagged as subscription-related
 * (signup / renewal / cancellation / trial / price_change).
 *
 * The output describes ONE subscription event. We're not trying to dedupe
 * here — that's the dedupe pass's job. The pipeline will:
 *   - upsert a subscription keyed on (merchant, billing_cycle, amount, currency)
 *   - record a `subscription_charge` if this email represents a charge
 *   - update status / trial_end_date / next_renewal_date when given
 */
import { z, runStructured } from '../client.js';
import type { EmailRow } from '../../domain/types.js';
import { config } from '../../config.js';

const SUBSCRIPTION_SYSTEM = `You are an extraction model for a personal-finance app, focused on
recurring subscriptions.

Given a single email about a subscription event (signup, renewal, trial,
cancellation, or price change), extract structured fields. Rules:

1. action: classify the event itself.
   - "signup": user just started a paid subscription.
   - "renewal": a recurring charge has just gone through.
   - "trial": a free trial started or is being announced.
   - "trial_ending": a trial will convert to paid soon.
   - "cancellation": the subscription has been cancelled.
   - "price_change": the price is going up or down.
   - "unknown": cannot tell.
2. billing_cycle: "weekly" | "monthly" | "quarterly" | "annually" | "unknown".
   Map common phrases: "/mo" → monthly, "/yr" → annually, "every 4 weeks"
   → monthly, "every 3 months" → quarterly.
3. amount_cents: the recurring amount, in cents. For price_change emails this
   is the NEW amount, and you should also fill prior_amount_cents.
4. plan_name: e.g. "Premium Family", "Pro Annual". May be null.
5. next_renewal_date / trial_end_date: ISO YYYY-MM-DD when stated.
6. NEVER hallucinate dates or amounts that aren't in the email.`;

export const SubscriptionExtractionSchema = z.object({
  is_subscription: z.boolean(),
  merchant_name: z.string(),
  plan_name: z.string().nullable(),
  amount_cents: z.number().int().nonnegative(),
  prior_amount_cents: z.number().int().nullable(),
  currency: z.string(),
  billing_cycle: z.enum(['weekly', 'monthly', 'quarterly', 'annually', 'unknown']),
  action: z.enum([
    'signup',
    'renewal',
    'trial',
    'trial_ending',
    'cancellation',
    'price_change',
    'unknown',
  ]),
  next_renewal_date: z.string().nullable(),
  trial_end_date: z.string().nullable(),
  notes: z.string().nullable(),
});

export type SubscriptionExtraction = z.infer<typeof SubscriptionExtractionSchema>;

function buildUser(e: EmailRow): string {
  const body = (e.body_text ?? '').slice(0, 8 * 1024);
  return `From: ${e.from_name ? `"${e.from_name}" ` : ''}<${e.from_address}>
Subject: ${e.subject ?? ''}

${body}`;
}

export interface SubscriptionResult {
  extraction: SubscriptionExtraction;
  model: string;
}

export async function extractSubscription(e: EmailRow): Promise<SubscriptionResult> {
  const { data, usage } = await runStructured({
    system: SUBSCRIPTION_SYSTEM,
    user: buildUser(e),
    schema: SubscriptionExtractionSchema,
    toolName: 'record_subscription_event',
    toolDescription: 'Record the structured fields of a subscription event.',
    timeoutMs: 60_000,
  });
  return {
    extraction: data,
    model: usage.model || config.llm.anthropic.model,
  };
}
