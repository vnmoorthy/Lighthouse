/**
 * Paystub extractor.
 *
 * Pulls structured income from a paycheck-style email. Output is the
 * shape `db/income.ts` wants — net pay (post-tax) is what we record,
 * since that's the actual money in the user's bank account.
 *
 * Calibration: paystub formatting varies wildly across payroll providers
 * (ADP / Gusto / Rippling / Paychex / Square Payroll / Wave / quickbooks
 * / direct from finance teams). The prompt asks for ranges so we fall
 * back gracefully if any single field can't be read.
 */
import { z, runStructured } from '../client.js';
import { config } from '../../config.js';
import type { EmailRow } from '../../domain/types.js';

const SYSTEM = `You are an extraction model focused on payroll / paycheck emails.

Given a single email confirming you've been paid, extract:
  - source: the employer or payer name
  - net_amount_cents: the deposited / take-home amount (NOT gross). If
    only gross is shown, use that and set notes='gross only'.
  - currency: ISO 4217. Default USD only when the merchant is clearly US.
  - received_at: the deposit / pay date. Prefer the date the money
    actually moved. YYYY-MM-DD.
  - cycle: weekly / biweekly / monthly / quarterly / annually if you can
    infer it. Otherwise null.
  - is_paystub: true unless this is some other kind of "you got money"
    email like a refund.

NEVER hallucinate. Leave fields null if not clearly present in the email.`;

export const PaystubExtractionSchema = z.object({
  is_paystub: z.boolean(),
  source: z.string(),
  net_amount_cents: z.number().int().nonnegative(),
  currency: z.string(),
  received_at: z.string(),
  cycle: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annually']).nullable(),
  confidence: z.number().min(0).max(1),
  notes: z.string().nullable(),
});

export type PaystubExtraction = z.infer<typeof PaystubExtractionSchema>;

export interface PaystubResult {
  extraction: PaystubExtraction;
  model: string;
}

function buildUser(e: EmailRow): string {
  const body = (e.body_text ?? '').slice(0, 8 * 1024);
  return `From: ${e.from_name ? `"${e.from_name}" ` : ''}<${e.from_address}>
Subject: ${e.subject ?? ''}

${body}`;
}

export async function extractPaystub(e: EmailRow): Promise<PaystubResult> {
  const { data, usage } = await runStructured({
    system: SYSTEM,
    user: buildUser(e),
    schema: PaystubExtractionSchema,
    toolName: 'record_paystub',
    toolDescription: 'Record the structured fields of a payroll / paycheck email.',
    timeoutMs: 60_000,
  });
  return {
    extraction: data,
    model: usage.model || config.llm.anthropic.model,
  };
}
