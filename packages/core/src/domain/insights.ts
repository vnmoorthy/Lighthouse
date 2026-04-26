/**
 * Insights — small set of "did you notice…?" cards we can surface on the
 * Overview page.
 *
 * Each insight is a comparison or trend that wouldn't be obvious from the
 * raw KPI grid:
 *   - Category MoM change (food spend up 35% vs last month)
 *   - First-time merchant (you charged at Foo for the first time this month)
 *   - Streak (DoorDash trending up 3 months in a row)
 *   - Big-ticket day (a 1-day spike outside your typical pattern)
 *
 * All math is computed from the database; no LLM. Intentionally
 * conservative thresholds — we'd rather show 2 insights than 8 noisy ones.
 */
import { getDb } from '../db/index.js';

const DAY = 24 * 60 * 60 * 1000;
const MONTH = 30 * DAY;

export type InsightKind =
  | 'category_change'
  | 'first_time_merchant'
  | 'category_streak'
  | 'big_day';

export interface Insight {
  kind: InsightKind;
  headline: string;
  detail?: string;
  href?: string;
  weight: number; // for sorting; higher = more interesting
}

export function getInsights(limit = 6): Insight[] {
  const db = getDb();
  const out: Insight[] = [];
  const now = Date.now();

  // ----- 1. Category MoM change -------------------------------------------
  const monthStart = (offsetMonths: number) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(1);
    d.setMonth(d.getMonth() - offsetMonths);
    return d.getTime();
  };
  const thisMonthStart = monthStart(0);
  const lastMonthStart = monthStart(1);

  const monthCat = db
    .prepare(
      `SELECT COALESCE(m.category, 'other') as category,
              SUM(r.total_amount_cents) as total
       FROM receipts r JOIN merchants m ON m.id = r.merchant_id
       WHERE r.transaction_date >= ? AND r.transaction_date < ?
       GROUP BY category`,
    );
  const thisMonth = monthCat.all(thisMonthStart, now) as { category: string; total: number }[];
  const lastMonth = monthCat.all(lastMonthStart, thisMonthStart) as { category: string; total: number }[];
  const lastMap = new Map(lastMonth.map((r) => [r.category, r.total]));
  for (const t of thisMonth) {
    const prev = lastMap.get(t.category) ?? 0;
    if (prev < 2000) continue; // ignore tiny prior baselines (<$20)
    if (t.total < 2000) continue;
    const delta = ((t.total - prev) / prev) * 100;
    if (Math.abs(delta) < 25) continue; // need a meaningful swing
    out.push({
      kind: 'category_change',
      headline:
        delta > 0
          ? `${capitalize(t.category)} spending is up ${delta.toFixed(0)}% vs last month`
          : `${capitalize(t.category)} spending is down ${Math.abs(delta).toFixed(0)}% vs last month`,
      detail: `${formatMoney(t.total)} this month, ${formatMoney(prev)} last month.`,
      href: `/receipts?category=${t.category}`,
      weight: Math.abs(delta) + (delta > 0 ? 5 : 0), // slight bias to surface increases
    });
  }

  // ----- 2. First-time merchants this month -------------------------------
  const firstTime = db
    .prepare(
      `SELECT m.id, m.display_name, MIN(r.transaction_date) as first_seen,
              COUNT(*) as total_count
       FROM receipts r JOIN merchants m ON m.id = r.merchant_id
       GROUP BY m.id
       HAVING first_seen >= ?
       ORDER BY first_seen DESC LIMIT 5`,
    )
    .all(thisMonthStart) as { id: number; display_name: string; first_seen: number; total_count: number }[];
  for (const m of firstTime) {
    out.push({
      kind: 'first_time_merchant',
      headline: `First charge at ${m.display_name}`,
      detail: `New merchant in your inbox this month.`,
      href: `/merchants/${m.id}`,
      weight: 30,
    });
  }

  // ----- 3. Category streak (3+ months trending up) -----------------------
  const monthly = db
    .prepare(
      `SELECT COALESCE(m.category, 'other') as category,
              strftime('%Y-%m', r.transaction_date / 1000, 'unixepoch') as ym,
              SUM(r.total_amount_cents) as total
       FROM receipts r JOIN merchants m ON m.id = r.merchant_id
       WHERE r.transaction_date >= ?
       GROUP BY category, ym ORDER BY category, ym`,
    )
    .all(now - 6 * MONTH) as { category: string; ym: string; total: number }[];
  const byCat = new Map<string, { ym: string; total: number }[]>();
  for (const m of monthly) {
    const arr = byCat.get(m.category) ?? [];
    arr.push({ ym: m.ym, total: m.total });
    byCat.set(m.category, arr);
  }
  for (const [cat, arr] of byCat.entries()) {
    if (arr.length < 4) continue;
    const last4 = arr.slice(-4);
    let strictlyUp = true;
    for (let i = 1; i < last4.length; i++) {
      if (last4[i]!.total <= last4[i - 1]!.total) {
        strictlyUp = false;
        break;
      }
    }
    if (strictlyUp && last4[last4.length - 1]!.total > 5000) {
      out.push({
        kind: 'category_streak',
        headline: `${capitalize(cat)} has grown four months in a row`,
        detail: `From ${formatMoney(last4[0]!.total)} → ${formatMoney(last4[last4.length - 1]!.total)}.`,
        href: `/receipts?category=${cat}`,
        weight: 50,
      });
    }
  }

  // ----- 4. Big-ticket day in the last 30 days ----------------------------
  const dailyTotals = db
    .prepare(
      `SELECT strftime('%Y-%m-%d', transaction_date / 1000, 'unixepoch') as day,
              SUM(total_amount_cents) as total, COUNT(*) as count
       FROM receipts WHERE transaction_date >= ? GROUP BY day`,
    )
    .all(now - 90 * DAY) as { day: string; total: number; count: number }[];
  if (dailyTotals.length > 7) {
    const sorted = [...dailyTotals].sort((a, b) => a.total - b.total);
    const median = sorted[Math.floor(sorted.length / 2)]!.total;
    const recent30 = dailyTotals.filter((d) => {
      const ts = new Date(d.day).getTime();
      return ts >= now - 30 * DAY;
    });
    const top = recent30.sort((a, b) => b.total - a.total)[0];
    if (top && median > 0 && top.total > median * 5 && top.total > 5000) {
      out.push({
        kind: 'big_day',
        headline: `${formatMoney(top.total)} spent on ${formatDay(top.day)}`,
        detail: `${top.count} purchase${top.count === 1 ? '' : 's'} — ${(top.total / median).toFixed(1)}× a typical day.`,
        weight: 25,
      });
    }
  }

  out.sort((a, b) => b.weight - a.weight);
  return out.slice(0, limit);
}

function capitalize(s: string): string {
  if (!s) return s;
  return s[0]!.toUpperCase() + s.slice(1);
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function formatDay(yyyyMmDd: string): string {
  const d = new Date(yyyyMmDd);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
