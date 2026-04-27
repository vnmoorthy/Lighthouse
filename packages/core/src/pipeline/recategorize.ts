/**
 * Auto-recategorize pass.
 *
 * Targets:
 *   - merchants with category = 'other' (the LLM normalizer fell through)
 *   - receipts with confidence < CONFIDENCE_FLOOR (the extractor was unsure)
 *
 * For each target merchant, we fetch a sample receipt and ask the LLM
 * "given this merchant + a sample receipt, which category fits best?".
 * Cheap call, ~50 tokens out, runs once per merchant — not per receipt.
 *
 * Receipts with low confidence are re-run through the receipt extractor
 * to see if a fresh prompt + the model's improvements help.
 */
import pLimit from 'p-limit';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { setMerchantCategory } from '../db/queries.js';
import { runStructured } from '../llm/client.js';
import { config } from '../config.js';
import { log } from '../logger.js';

const CONFIDENCE_FLOOR = 0.6;

const CategorySchema = z.object({
  category: z.string(),
  confidence: z.number().min(0).max(1),
});

const SYSTEM = `You are a merchant-categorizer for a personal-finance app.

Given a merchant's name + domain + a one-line example receipt, assign
the best-fitting category from this enum:
  shopping, groceries, food, streaming, productivity, developer, fitness,
  transit, travel, payments, utilities, cloud, news, apps, other.

Be conservative — if you're not at ≥0.7 confidence, return 'other'.`;

interface MerchantToCategorize {
  id: number;
  display_name: string;
  domain: string | null;
  sample_subject: string | null;
  sample_total_cents: number | null;
}

export interface RecategorizeStats {
  merchants_examined: number;
  merchants_updated: number;
  errors: number;
}

/** Re-categorize merchants that landed on 'other'. */
export async function recategorizeMerchants(): Promise<RecategorizeStats> {
  const db = getDb();
  const targets = db
    .prepare(
      `SELECT m.id, m.display_name, m.domain,
              (SELECT subject FROM emails e
               JOIN receipts r ON r.email_id = e.id
               WHERE r.merchant_id = m.id LIMIT 1) AS sample_subject,
              (SELECT total_amount_cents FROM receipts r
               WHERE r.merchant_id = m.id LIMIT 1) AS sample_total_cents
       FROM merchants m
       WHERE m.category IS NULL OR m.category = 'other'`,
    )
    .all() as MerchantToCategorize[];

  if (targets.length === 0) {
    log.info('recategorize: nothing to do.');
    return { merchants_examined: 0, merchants_updated: 0, errors: 0 };
  }
  log.info(`recategorize: ${targets.length} merchants to look at.`);

  const limiter = pLimit(config.llm.concurrency);
  let updated = 0;
  let errors = 0;
  await Promise.all(
    targets.map((m) =>
      limiter(async () => {
        try {
          const total = m.sample_total_cents != null
            ? `$${(m.sample_total_cents / 100).toFixed(2)}`
            : '(unknown)';
          const userPrompt = `Merchant: ${m.display_name}
Domain: ${m.domain ?? 'unknown'}
Sample receipt subject: ${m.sample_subject ?? '(none)'}
Sample total: ${total}`;
          const { data } = await runStructured({
            system: SYSTEM,
            user: userPrompt,
            schema: CategorySchema,
            toolName: 'pick_category',
            toolDescription: 'Choose the best category for this merchant.',
            timeoutMs: 15_000,
          });
          if (data.confidence >= 0.7 && data.category !== 'other') {
            setMerchantCategory(m.id, data.category);
            updated++;
          }
        } catch (e) {
          errors++;
          log.warn(`recategorize merchant ${m.id} failed: ${(e as Error).message}`);
        }
      }),
    ),
  );

  log.info(`recategorize: updated ${updated}, errors ${errors}.`);
  return { merchants_examined: targets.length, merchants_updated: updated, errors };
}

/** Find receipts under the confidence floor. (Doesn't run LLM yet — exposes ids.) */
export function listLowConfidenceReceipts(limit = 100): {
  id: number;
  email_id: number;
  merchant: string;
  total_cents: number;
  confidence: number;
}[] {
  return getDb()
    .prepare(
      `SELECT r.id, r.email_id, m.display_name as merchant,
              r.total_amount_cents as total_cents, r.confidence
       FROM receipts r JOIN merchants m ON m.id = r.merchant_id
       WHERE r.confidence < ?
       ORDER BY r.confidence ASC LIMIT ?`,
    )
    .all(CONFIDENCE_FLOOR, limit) as {
    id: number;
    email_id: number;
    merchant: string;
    total_cents: number;
    confidence: number;
  }[];
}
