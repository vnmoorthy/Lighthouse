/**
 * Income queries.
 *
 * The math layer Lighthouse needs once you start asking "what % of my
 * income is on subscriptions" or "am I net positive this month".
 */
import { getDb } from './index.js';

export interface IncomeRow {
  id: number;
  source: string;
  amount_cents: number;
  currency: string;
  received_at: number;
  recurring: number;
  cycle: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually' | null;
  note: string | null;
  created_at: number;
}

export function listIncome(limit = 100): IncomeRow[] {
  return getDb()
    .prepare('SELECT * FROM income ORDER BY received_at DESC LIMIT ?')
    .all(limit) as IncomeRow[];
}

export function createIncome(input: Omit<IncomeRow, 'id' | 'created_at'>): IncomeRow {
  const r = getDb()
    .prepare(
      `INSERT INTO income (source, amount_cents, currency, received_at, recurring, cycle, note, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
    )
    .run(
      input.source,
      input.amount_cents,
      input.currency,
      input.received_at,
      input.recurring,
      input.cycle,
      input.note,
      Date.now(),
    );
  return getDb().prepare('SELECT * FROM income WHERE id = ?').get(Number(r.lastInsertRowid)) as IncomeRow;
}

export function deleteIncome(id: number): void {
  getDb().prepare('DELETE FROM income WHERE id = ?').run(id);
}

export interface IncomeSummary {
  trailing_30d_cents: number;
  trailing_90d_cents: number;
  trailing_365d_cents: number;
  monthly_recurring_cents: number;
}

/** Compute trailing-window sums + recurring monthly equivalent. */
export function getIncomeSummary(): IncomeSummary {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const sumSince = (cutoff: number): number =>
    (getDb()
      .prepare(
        'SELECT COALESCE(SUM(amount_cents), 0) as s FROM income WHERE received_at >= ?',
      )
      .get(cutoff) as { s: number }).s;

  // Recurring → monthly equivalent.
  const recurring = getDb()
    .prepare(`SELECT amount_cents, cycle FROM income WHERE recurring = 1`)
    .all() as { amount_cents: number; cycle: IncomeRow['cycle'] }[];
  const monthly = recurring.reduce((acc, r) => {
    const c = r.cycle ?? 'monthly';
    if (c === 'weekly') return acc + Math.round(r.amount_cents * (52 / 12));
    if (c === 'biweekly') return acc + Math.round(r.amount_cents * (26 / 12));
    if (c === 'monthly') return acc + r.amount_cents;
    if (c === 'quarterly') return acc + Math.round(r.amount_cents / 3);
    if (c === 'annually') return acc + Math.round(r.amount_cents / 12);
    return acc;
  }, 0);

  return {
    trailing_30d_cents: sumSince(now - 30 * DAY),
    trailing_90d_cents: sumSince(now - 90 * DAY),
    trailing_365d_cents: sumSince(now - 365 * DAY),
    monthly_recurring_cents: monthly,
  };
}
