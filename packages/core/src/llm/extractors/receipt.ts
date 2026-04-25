/**
 * Receipt extractor — Stage 2.
 *
 * Runs on emails that the classifier said are `receipt` or
 * `subscription_renewal`. Produces a structured ReceiptExtraction object
 * which the pipeline turns into a row in `receipts` (and a charge if it's
 * tied to an existing subscription).
 *
 * Keep the prompt tight: the model is rewarded only for fields it can prove,
 * and we explicitly tell it to leave fields null rather than guess.
 */
import { z, runStructured } from '../client.js';
import type { EmailRow } from '../../domain/types.js';
import { config } from '../../config.js';

const RECEIPT_SYSTEM = `You are an extraction model for a personal-finance app.

Given a single email that the user has confirmed is a purchase receipt,
extract structured data about the transaction. Rules:

1. Money: amounts are integer cents in the smallest currency unit (USD cents,
   GBP pence, JPY yen). Currency is the ISO 4217 code (USD, EUR, GBP, …).
   If you can't determine the currency, default to "USD" only if you have a
   strong prior (e.g., the merchant is US-based); otherwise leave currency
   blank by setting it to "UNK".
2. Dates: transaction_date is the date the charge happened, in YYYY-MM-DD.
   If only an order date is present, use that.
3. Merchant: a clean human-readable name ("Amazon", "Netflix", "Spotify"),
   not a transaction descriptor like "AMZN Mktp US*1A2B3".
4. Line items: extract them when clearly listed. quantity may be null. The
   sum of line items may not equal the total — taxes, shipping, and
   discounts are common — that's OK.
5. NEVER hallucinate. If a field is not present, set it to null.
6. Order number: the merchant's order/invoice id. Strip any "#" prefix.
7. Payment method: extract "Visa ending in 1234" style strings only.

Confidence:
- 1.00 — every required field present, total matches the email's bold "Total".
- 0.80 — minor ambiguity (e.g. tip rolled into total, foreign currency).
- 0.50 — unsure about merchant or amount; flag for review.
- 0.20 — almost certainly not actually a receipt, but extraction was attempted.`;

export const ReceiptExtractionSchema = z.object({
  is_receipt: z.boolean(),
  merchant_name: z.string(),
  total_amount_cents: z.number().int().nonnegative(),
  currency: z.string(),
  transaction_date: z.string(), // YYYY-MM-DD
  order_number: z.string().nullable(),
  payment_method: z.string().nullable(),
  line_items: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number().nullable(),
        unit_price_cents: z.number().int().nullable(),
        total_cents: z.number().int().nullable(),
      }),
    )
    .nullable(),
  confidence: z.number().min(0).max(1),
  notes: z.string().nullable(),
});

export type ReceiptExtraction = z.infer<typeof ReceiptExtractionSchema>;

function buildUser(e: EmailRow): string {
  // We pass plaintext only. HTML→text in parse.ts already happened.
  // Cap at 8KB; receipts are usually under 4KB.
  const body = (e.body_text ?? '').slice(0, 8 * 1024);
  return `From: ${e.from_name ? `"${e.from_name}" ` : ''}<${e.from_address}>
Subject: ${e.subject ?? ''}

${body}`;
}

export interface ReceiptResult {
  extraction: ReceiptExtraction;
  model: string;
}

export async function extractReceipt(e: EmailRow): Promise<ReceiptResult> {
  const { data, usage } = await runStructured({
    system: RECEIPT_SYSTEM,
    user: buildUser(e),
    schema: ReceiptExtractionSchema,
    toolName: 'record_receipt',
    toolDescription: 'Record the structured fields of a purchase receipt.',
    timeoutMs: 60_000,
  });
  return {
    extraction: data,
    model: usage.model || config.llm.anthropic.model,
  };
}
