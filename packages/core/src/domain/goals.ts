/**
 * Goals — long-horizon spending caps.
 *
 * A goal is "spend at most $X on category C between date A and date B".
 * Period is one of weekly/monthly/annual/custom. The progress evaluator
 * computes the right window for each non-custom period.
 *
 * Like budgets, we tag any breach into the alerts table with the
 * `custom` type so the dashboard surfaces them.
 */
import { getDb } from '../db/index.js';
import { insertAlert } from '../db/queries.js';
import { log } from '../logger.js';

const DAY = 24 * 60 * 60 * 1000;

export type GoalPeriod = 'weekly' | 'monthly' | 'annual' | 'custom';

export interface Goal {
  id: number;
  name: string;
  category: string | null;
  cap_cents: number;
  period: GoalPeriod;
  start_date: number | null;
  end_date: number | null;
  created_at: number;
  updated_at: number;
}

export interface GoalProgress extends Goal {
  window_start: number;
  window_end: number;
  used_cents: number;
  remaining_cents: number;
  pct_used: number;
  pct_of_window: number;
}

function currentWindow(p: GoalPeriod, start?: number | null, end?: number | null): { from: number; to: number } {
  const now = new Date();
  if (p === 'weekly') {
    // Monday-anchored.
    const d = new Date(now);
    const dow = d.getDay() || 7; // make Sunday = 7
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (dow - 1));
    return { from: d.getTime(), to: d.getTime() + 7 * DAY };
  }
  if (p === 'monthly') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    return { from, to };
  }
  if (p === 'annual') {
    const from = new Date(now.getFullYear(), 0, 1).getTime();
    const to = new Date(now.getFullYear() + 1, 0, 1).getTime();
    return { from, to };
  }
  return { from: start ?? 0, to: end ?? Date.now() + 30 * DAY };
}

export function listGoals(): Goal[] {
  return getDb().prepare('SELECT * FROM goals ORDER BY id').all() as Goal[];
}

export function createGoal(input: {
  name: string;
  category: string | null;
  cap_cents: number;
  period: GoalPeriod;
  start_date?: number | null;
  end_date?: number | null;
}): Goal {
  const now = Date.now();
  const r = getDb()
    .prepare(
      `INSERT INTO goals (name, category, cap_cents, period, start_date, end_date, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)`,
    )
    .run(
      input.name,
      input.category,
      input.cap_cents,
      input.period,
      input.start_date ?? null,
      input.end_date ?? null,
      now,
      now,
    );
  return getDb().prepare('SELECT * FROM goals WHERE id = ?').get(Number(r.lastInsertRowid)) as Goal;
}

export function deleteGoal(id: number): void {
  getDb().prepare('DELETE FROM goals WHERE id = ?').run(id);
}

export function getGoalProgress(): GoalProgress[] {
  const db = getDb();
  return listGoals().map((g) => {
    const w = currentWindow(g.period, g.start_date, g.end_date);
    const params: unknown[] = [w.from, w.to];
    let where = 'r.transaction_date >= ? AND r.transaction_date < ?';
    if (g.category) {
      where += ' AND m.category = ?';
      params.push(g.category);
    }
    const usage = db
      .prepare(
        `SELECT COALESCE(SUM(r.total_amount_cents), 0) as used FROM receipts r
         JOIN merchants m ON m.id = r.merchant_id
         WHERE ${where}`,
      )
      .get(...params) as { used: number };
    const used = Math.max(0, usage.used);
    const span = Math.max(1, w.to - w.from);
    const elapsed = Math.min(1, Math.max(0, (Date.now() - w.from) / span));
    return {
      ...g,
      window_start: w.from,
      window_end: w.to,
      used_cents: used,
      remaining_cents: g.cap_cents - used,
      pct_used: g.cap_cents > 0 ? used / g.cap_cents : 0,
      pct_of_window: elapsed,
    };
  });
}

/** Fire alerts for goals at >= 80% of cap. */
export function evaluateGoals(): { fired: number; evaluated: number } {
  const progress = getGoalProgress();
  let fired = 0;
  for (const g of progress) {
    if (g.pct_used >= 0.8) {
      const made = insertAlert({
        type: 'custom',
        subject_id: g.id,
        subject_table: 'goals',
        payload: {
          rule_name: `${g.name} at ${(g.pct_used * 100).toFixed(0)}%`,
          goal_name: g.name,
          category: g.category,
          period: g.period,
          used_cents: g.used_cents,
          cap_cents: g.cap_cents,
        },
      });
      if (made) fired++;
    }
  }
  if (fired > 0) log.info(`Goal alerts: ${fired} fired across ${progress.length} goals.`);
  return { fired, evaluated: progress.length };
}
