/**
 * `lighthouse digest`
 *
 * Prints a markdown summary of the last 7 days (or N) suitable for piping
 * to a file or emailing yourself via cron.
 *
 *   lighthouse digest              -> last 7 days, to stdout
 *   lighthouse digest --days 30    -> last 30 days
 *   lighthouse digest --json       -> emit JSON instead
 */
import {
  getDb,
  getInsights,
  getSubscriptionHealth,
  listOpenAlerts,
  listReceipts,
  listSubscriptions,
} from '@lighthouse/core';

interface DigestOpts {
  days?: string;
  json?: boolean;
}

const DAY = 24 * 60 * 60 * 1000;

function fmt(cents: number): string {
  return '$' + (cents / 100).toFixed(2);
}

export async function digestCommand(opts: DigestOpts): Promise<void> {
  getDb();
  const days = Number.parseInt(opts.days ?? '7', 10);
  const cutoff = Date.now() - days * DAY;

  const recent = listReceipts({ from: cutoff, limit: 5000 }).rows;
  const total = recent.reduce((acc, r) => acc + r.total_amount_cents, 0);
  const byMerchant = new Map<string, number>();
  for (const r of recent) {
    byMerchant.set(
      r.merchant_display_name,
      (byMerchant.get(r.merchant_display_name) ?? 0) + r.total_amount_cents,
    );
  }
  const topMerchants = [...byMerchant.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const trial = listSubscriptions('trial');
  const alerts = listOpenAlerts();
  const insights = getInsights(5);
  const health = getSubscriptionHealth();

  const data = {
    period_days: days,
    period_start: new Date(cutoff).toISOString().slice(0, 10),
    period_end: new Date().toISOString().slice(0, 10),
    total_spent_cents: total,
    receipt_count: recent.length,
    monthly_subscription_cost_cents: health.monthly_cost_cents,
    active_subscriptions: health.total_active,
    trial_subscriptions: trial.length,
    open_alerts: alerts.length,
    top_merchants: topMerchants.map(([name, c]) => ({ merchant: name, total_cents: c })),
    forgotten_subscriptions: health.forgotten,
    insights,
    trial_alerts: trial
      .filter((t) => t.trial_end_date)
      .map((t) => ({
        merchant: t.merchant_display_name,
        trial_end_date: new Date(t.trial_end_date!).toISOString().slice(0, 10),
        days_until_end: Math.ceil(
          ((t.trial_end_date ?? 0) - Date.now()) / DAY,
        ),
        amount_cents: t.amount_cents,
      })),
  };

  if (opts.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Human-readable Markdown.
  const out: string[] = [];
  out.push(`# Lighthouse digest`);
  out.push(`*${data.period_start} → ${data.period_end} (${days} days)*`);
  out.push('');
  out.push(`## Spend summary`);
  out.push('');
  out.push(`- **Total spent:** ${fmt(data.total_spent_cents)} across ${data.receipt_count} receipts`);
  out.push(`- **Monthly subscription run rate:** ${fmt(data.monthly_subscription_cost_cents)}`);
  out.push(`- **Active subscriptions:** ${data.active_subscriptions}${data.trial_subscriptions ? ` (+${data.trial_subscriptions} on trial)` : ''}`);
  out.push(`- **Open alerts:** ${data.open_alerts}`);
  out.push('');

  if (topMerchants.length > 0) {
    out.push(`## Top merchants this period`);
    out.push('');
    for (const [name, c] of topMerchants) {
      out.push(`- ${name}: **${fmt(c)}**`);
    }
    out.push('');
  }

  if (data.trial_alerts.length > 0) {
    out.push(`## Trials ending soon`);
    out.push('');
    for (const t of data.trial_alerts) {
      out.push(
        `- **${t.merchant}** ends ${t.trial_end_date} (in ${t.days_until_end} days) → ${fmt(t.amount_cents)}/mo`,
      );
    }
    out.push('');
  }

  if (data.forgotten_subscriptions.length > 0) {
    out.push(`## Possibly forgotten subscriptions`);
    out.push('');
    for (const f of data.forgotten_subscriptions) {
      out.push(
        `- **${f.merchant}** — last charge was ${f.days_since_last_charge} days ago (${fmt(f.amount_cents)})`,
      );
    }
    out.push('');
  }

  if (insights.length > 0) {
    out.push(`## Things to notice`);
    out.push('');
    for (const i of insights) {
      out.push(`- ${i.headline}${i.detail ? ` — ${i.detail}` : ''}`);
    }
    out.push('');
  }

  console.log(out.join('\n'));
}
