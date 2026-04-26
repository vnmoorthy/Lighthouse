/**
 * Per-category monthly budgets.
 *
 * The math:
 *   - "Used" = sum of receipts in this calendar month for the category.
 *   - "Cap"  = budgets.amount_cents.
 *   - Pace   = used / (cap × elapsed_pct_of_month).  >1 means you're
 *              spending faster than budget pace; <1 means under.
 *
 * Alerts fire when used ≥ 80% of cap. We tag the alert with the budget
 * id so the dashboard can deep-link.
 */
import { getDb } from '../db/index.js';
import { insertAlert } from '../db/queries.js';
import { log } from '../logger.js';

const DAY = 24 * 60 * 60 * 1000;

export interface Budget {
  id: number;
  category: string;
  amount_cents: number;
  created_at: number;
  updated_at: number;
}

export interface BudgetProgress extends Budget {
  used_cents: number;
  remaining_cents: number;
  pct_used: number;
  pct_of_month: number;
  pace_ratio: number; // >1 = ahead of pace, <1 = under
}

export function listBudgets(): Budget[] {
  return getDb().prepare('SELECT * FROM budgets ORDER BY category').all() as Budget[];
}

export function upsertBudget(category: string, amountCents: number): Budget {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO budgets (category, amount_cents, created_at, updated_at)
       VALUES (?,?,?,?)
       ON CONFLICT(category) DO UPDATE SET
         amount_cents = excluded.amount_cents, updated_at = excluded.updated_at`,
    )
    .run(category, amountCents, now, now);
  return getDb().prepare('SELECT * FROM budgets WHERE category = ?').get(category) as Budget;
}

export function deleteBudget(id: number): void {
  getDb().prepare('DELETE FROM budgets WHERE id = ?').run(id);
}

/** Compute progress for every defined budget against the current month. */
export function getBudgetProgress(): BudgetProgress[] {
  const db = getDb();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const elapsed = (Date.now() - monthStart) / (monthEnd - monthStart);
  const pctOfMonth = Math.min(1, Math.max(0, elapsed));

  const usage = new Map<string, number>(
    (db
      .prepare(
        `SELECT COALESCE(m.category, 'other') as category,
                SUM(r.total_amount_cents) as used
         FROM receipts r JOIN merchants m ON m.id = r.merchant_id
         WHERE r.transaction_date >= ?
         GROUP BY category`,
      )
      .all(monthStart) as { category: string; used: number }[]).map((r) => [r.category, r.used]),
  );

  return listBudgets().map((b) => {
    const used = Math.max(0, usage.get(b.category) ?? 0);
    const pct = b.amount_cents > 0 ? used / b.amount_cents : 0;
    const pace = pctOfMonth > 0 ? used / Math.max(1, b.amount_cents * pctOfMonth) : 0;
    return {
      ...b,
      used_cents: used,
      remaining_cents: b.amount_cents - used,
      pct_used: pct,
      pct_of_month: pctOfMonth,
      pace_ratio: pace,
    };
  });
}

/** Fire alerts for budgets at >=80% of cap. */
export function evaluateBudgets(): { fired: number; evaluated: number } {
  const progress = getBudgetProgress();
  let fired = 0;
  for (const p of progress) {
    if (p.pct_used >= 0.8) {
      const made = insertAlert({
        type: 'custom',
        subject_id: p.id,
        subject_table: 'budgets',
        payload: {
          rule_name: `${capitalize(p.category)} budget at ${(p.pct_used * 100).toFixed(0)}%`,
          category: p.category,
          used_cents: p.used_cents,
          cap_cents: p.amount_cents,
          pct_used: p.pct_used,
          pace_ratio: p.pace_ratio,
        },
      });
      if (made) fired++;
    }
  }
  if (fired > 0) log.info(`Budget alerts: ${fired} fired across ${progress.length} budgets.`);
  void DAY;
  return { fired, evaluated: progress.length };
}

function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}
