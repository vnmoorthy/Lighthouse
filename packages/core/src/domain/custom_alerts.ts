/**
 * User-defined alert rules.
 *
 * The schema for `custom_alert_rules` is generic: a `type` discriminator
 * and a JSON payload. We dispatch on the discriminator below.
 *
 * Three rule types in v0.13:
 *   - merchant_threshold: total spend at merchant X over N days exceeds Y
 *   - category_threshold: total spend in category X over N days exceeds Y
 *   - any_charge:        any single charge at merchant X ≥ Y
 *
 * On a fire, we drop into the existing `alerts` table with type='custom'
 * and a payload that names the originating rule, so the dashboard can
 * link back to it.
 */
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { insertAlert } from '../db/queries.js';
import { log } from '../logger.js';

const DAY = 24 * 60 * 60 * 1000;

export const MerchantThresholdSchema = z.object({
  merchant_id: z.number().int().positive(),
  max_cents: z.number().int().positive(),
  window_days: z.number().int().min(1).max(365),
});
export const CategoryThresholdSchema = z.object({
  category: z.string().min(1),
  max_cents: z.number().int().positive(),
  window_days: z.number().int().min(1).max(365),
});
export const AnyChargeSchema = z.object({
  merchant_id: z.number().int().positive(),
  min_cents: z.number().int().positive(),
});

export type RuleType = 'merchant_threshold' | 'category_threshold' | 'any_charge';

export interface CustomRule {
  id: number;
  name: string;
  type: RuleType;
  payload: unknown;
  enabled: number;
  created_at: number;
  last_fired_at: number | null;
}

interface CustomRuleRow {
  id: number;
  name: string;
  type: RuleType;
  payload_json: string;
  enabled: number;
  created_at: number;
  last_fired_at: number | null;
}

export function listCustomRules(): CustomRule[] {
  const rows = getDb()
    .prepare('SELECT * FROM custom_alert_rules ORDER BY created_at DESC')
    .all() as CustomRuleRow[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    payload: JSON.parse(r.payload_json),
    enabled: r.enabled,
    created_at: r.created_at,
    last_fired_at: r.last_fired_at,
  }));
}

export function createCustomRule(input: {
  name: string;
  type: RuleType;
  payload: unknown;
}): number {
  // Validate the payload matches its type.
  const schema =
    input.type === 'merchant_threshold'
      ? MerchantThresholdSchema
      : input.type === 'category_threshold'
        ? CategoryThresholdSchema
        : AnyChargeSchema;
  const parsed = schema.safeParse(input.payload);
  if (!parsed.success) throw new Error(`Invalid payload: ${parsed.error.message}`);

  const r = getDb()
    .prepare(
      `INSERT INTO custom_alert_rules (name, type, payload_json, enabled, created_at)
       VALUES (?,?,?,?,?)`,
    )
    .run(input.name, input.type, JSON.stringify(parsed.data), 1, Date.now());
  return Number(r.lastInsertRowid);
}

export function deleteCustomRule(id: number): void {
  getDb().prepare('DELETE FROM custom_alert_rules WHERE id = ?').run(id);
}

export function toggleCustomRule(id: number, enabled: boolean): void {
  getDb()
    .prepare('UPDATE custom_alert_rules SET enabled = ? WHERE id = ?')
    .run(enabled ? 1 : 0, id);
}

/** Run every active rule and create alerts for any that fire. */
export function evaluateCustomRules(): { fired: number; evaluated: number } {
  const db = getDb();
  const rules = listCustomRules().filter((r) => r.enabled);
  let fired = 0;
  for (const rule of rules) {
    try {
      const matched = evaluate(rule);
      if (matched) {
        const made = insertAlert({
          type: 'custom',
          subject_id: rule.id,
          subject_table: 'custom_alert_rules',
          payload: matched,
        });
        if (made) {
          fired++;
          db.prepare('UPDATE custom_alert_rules SET last_fired_at = ? WHERE id = ?').run(
            Date.now(),
            rule.id,
          );
        }
      }
    } catch (e) {
      log.warn(`Custom rule ${rule.id} failed: ${(e as Error).message}`);
    }
  }
  if (fired > 0) log.info(`Custom alerts: ${fired} fired across ${rules.length} rules.`);
  return { fired, evaluated: rules.length };
}

function evaluate(rule: CustomRule): Record<string, unknown> | null {
  const db = getDb();
  if (rule.type === 'merchant_threshold') {
    const p = MerchantThresholdSchema.parse(rule.payload);
    const cutoff = Date.now() - p.window_days * DAY;
    const row = db
      .prepare(
        `SELECT m.display_name, COALESCE(SUM(r.total_amount_cents), 0) as total
         FROM merchants m LEFT JOIN receipts r
           ON r.merchant_id = m.id AND r.transaction_date >= ?
         WHERE m.id = ?`,
      )
      .get(cutoff, p.merchant_id) as { display_name: string; total: number } | undefined;
    if (!row || row.total < p.max_cents) return null;
    return {
      rule_name: rule.name,
      merchant: row.display_name,
      window_days: p.window_days,
      threshold_cents: p.max_cents,
      total_cents: row.total,
    };
  }
  if (rule.type === 'category_threshold') {
    const p = CategoryThresholdSchema.parse(rule.payload);
    const cutoff = Date.now() - p.window_days * DAY;
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(r.total_amount_cents), 0) as total
         FROM receipts r JOIN merchants m ON m.id = r.merchant_id
         WHERE m.category = ? AND r.transaction_date >= ?`,
      )
      .get(p.category, cutoff) as { total: number } | undefined;
    if (!row || row.total < p.max_cents) return null;
    return {
      rule_name: rule.name,
      category: p.category,
      window_days: p.window_days,
      threshold_cents: p.max_cents,
      total_cents: row.total,
    };
  }
  if (rule.type === 'any_charge') {
    const p = AnyChargeSchema.parse(rule.payload);
    // Only check the most-recent charge at this merchant.
    const row = db
      .prepare(
        `SELECT r.id as receipt_id, m.display_name, r.total_amount_cents, r.transaction_date
         FROM receipts r JOIN merchants m ON m.id = r.merchant_id
         WHERE r.merchant_id = ? ORDER BY r.transaction_date DESC LIMIT 1`,
      )
      .get(p.merchant_id) as
      | { receipt_id: number; display_name: string; total_amount_cents: number; transaction_date: number }
      | undefined;
    if (!row || row.total_amount_cents < p.min_cents) return null;
    return {
      rule_name: rule.name,
      merchant: row.display_name,
      receipt_id: row.receipt_id,
      amount_cents: row.total_amount_cents,
      threshold_cents: p.min_cents,
      observed_on: row.transaction_date,
    };
  }
  return null;
}
