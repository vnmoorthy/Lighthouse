/**
 * `lighthouse alerts` — print currently-open alerts.
 */
import chalk from 'chalk';
import { getDb, listOpenAlerts } from '@lighthouse/core';

const labels: Record<string, string> = {
  trial_ending: '⏳  Trial ending',
  price_increase: '⚠   Price change',
  new_subscription: '★   New subscription',
  duplicate_charge: '↺   Duplicate charge',
};

export async function alertsCommand(): Promise<void> {
  getDb();
  const alerts = listOpenAlerts();
  if (alerts.length === 0) {
    console.log(chalk.green('\n  ✓ No open alerts.'));
    return;
  }
  console.log(chalk.bold(`\n  Lighthouse alerts (${alerts.length} open)\n`));
  for (const a of alerts) {
    const p = JSON.parse(a.payload_json) as Record<string, unknown>;
    const head = labels[a.type] ?? a.type;
    console.log(`  ${chalk.cyan(head)}  ${chalk.gray(new Date(a.created_at).toLocaleString())}`);
    if (p.merchant) console.log(`    merchant: ${chalk.bold(String(p.merchant))}`);
    if (a.type === 'trial_ending' && p.days_until_end != null) {
      console.log(`    ends in:  ${p.days_until_end} day(s)`);
    }
    if (a.type === 'price_increase') {
      const oldA = (p.old_amount_cents as number | null) ?? 0;
      const newA = (p.new_amount_cents as number | null) ?? 0;
      console.log(
        `    change:   $${(oldA / 100).toFixed(2)} → $${(newA / 100).toFixed(2)} (${p.direction})`,
      );
    }
    if (a.type === 'new_subscription') {
      const c = (p.amount_cents as number | null) ?? 0;
      console.log(`    amount:   $${(c / 100).toFixed(2)} / ${p.billing_cycle}`);
    }
    if (a.type === 'duplicate_charge') {
      const a1 = p.receipt_a as { amount_cents: number; date: number } | undefined;
      const a2 = p.receipt_b as { amount_cents: number; date: number } | undefined;
      if (a1 && a2) {
        console.log(
          `    pair:     $${(a1.amount_cents / 100).toFixed(2)} on ${new Date(a1.date).toLocaleDateString()} ↔ $${(
            a2.amount_cents / 100
          ).toFixed(2)} on ${new Date(a2.date).toLocaleDateString()}`,
        );
      }
    }
    console.log();
  }
}
