/**
 * Merchant normalization.
 *
 * Goal: turn whatever string the LLM extractor produced ("AMZN Mktp US*1A2B3",
 * "Amazon Payments", "amazon.com") into a single canonical merchant id, so
 * the dashboard doesn't show the same vendor as four different rows.
 *
 * Strategy:
 *   1. Look in the merchant_alias_cache (raw_string + from_domain → merchant_id).
 *   2. Try the hand-rolled rule set in merchant_rules.ts.
 *   3. Fallback: use the LLM to suggest a canonical name; persist the alias
 *      so we never pay for it again.
 */
import { z, runStructured } from '../llm/client.js';
import {
  upsertMerchant,
  getMerchantAlias,
  putMerchantAlias,
} from '../db/queries.js';
import { findRuleMatch } from './merchant_rules.js';
import { log } from '../logger.js';

const NORMALIZE_SYSTEM = `You are a merchant-name normalizer. Given a raw merchant string (often
truncated, e.g. from a credit-card transaction descriptor) and the email's
sender domain, return a clean, human-readable canonical name.

Examples:
  raw="AMZN Mktp US*1A2B3", domain="amazon.com" → display="Amazon", canonical="amazon"
  raw="DD *DOORDASH SCRIBBL", domain="doordash.com" → display="DoorDash", canonical="doordash"
  raw="UBER *EATS", domain="ubereats.com" → display="Uber Eats", canonical="uber-eats"
  raw="Spotify USA", domain="spotify.com" → display="Spotify", canonical="spotify"

Rules:
- "canonical" must be lowercase, slug-style, kebab-case, no spaces.
- "display" should be the form a normal customer would recognize.
- Prefer the parent brand. ("Amazon Marketplace" → "Amazon".)
- "category" is one of: shopping, groceries, food, streaming, productivity,
  developer, fitness, transit, travel, payments, utilities, cloud, news,
  apps, other.`;

const NormalizeSchema = z.object({
  canonical: z.string(),
  display: z.string(),
  category: z.string(),
});

export interface NormalizedMerchant {
  id: number;
  canonical: string;
  display: string;
  category: string;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 64) || 'unknown';
}

/** Resolve `raw` (LLM-extracted merchant name) to a merchant_id. */
export async function resolveMerchant(
  rawMerchant: string,
  fromAddress: string,
): Promise<NormalizedMerchant> {
  const fromDomain = (fromAddress.split('@')[1] ?? '').toLowerCase();
  const cacheKey = (rawMerchant || '(unknown)').toLowerCase().trim();

  // 1. Cache.
  const cached = getMerchantAlias(cacheKey, fromDomain);
  if (cached) {
    return { id: cached, canonical: '', display: '', category: '' };
  }

  // 2. Hand-rolled rules.
  const rule = findRuleMatch(rawMerchant, fromAddress);
  if (rule) {
    const id = upsertMerchant({
      canonical_name: rule.canonical,
      display_name: rule.display,
      domain: fromDomain || null,
      category: rule.category,
    });
    putMerchantAlias(cacheKey, fromDomain, id);
    return { id, canonical: rule.canonical, display: rule.display, category: rule.category };
  }

  // 3. LLM fallback. Cheap and only paid once per (raw, domain) pair.
  try {
    const { data } = await runStructured({
      system: NORMALIZE_SYSTEM,
      user: `Raw merchant: "${rawMerchant}"\nSender domain: "${fromDomain}"`,
      schema: NormalizeSchema,
      toolName: 'normalize_merchant',
      toolDescription: 'Return a normalized canonical and display name.',
      timeoutMs: 20_000,
    });
    const id = upsertMerchant({
      canonical_name: slug(data.canonical),
      display_name: data.display.trim() || rawMerchant,
      domain: fromDomain || null,
      category: data.category || 'other',
    });
    putMerchantAlias(cacheKey, fromDomain, id);
    return { id, canonical: data.canonical, display: data.display, category: data.category };
  } catch (e) {
    log.warn(`Merchant normalize failed for "${rawMerchant}"; using raw.`, {
      error: (e as Error).message,
    });
    const id = upsertMerchant({
      canonical_name: slug(rawMerchant),
      display_name: rawMerchant.trim() || '(unknown)',
      domain: fromDomain || null,
      category: 'other',
    });
    putMerchantAlias(cacheKey, fromDomain, id);
    return { id, canonical: slug(rawMerchant), display: rawMerchant, category: 'other' };
  }
}
