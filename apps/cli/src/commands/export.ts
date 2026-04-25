/**
 * `lighthouse export` — write CSV (receipts) and JSON (subscriptions) to disk.
 *
 * The shape of the exports is the smallest thing that lets a user load the
 * data into a spreadsheet, accountant tool, or budget app.
 */
import chalk from 'chalk';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  getDb,
  listReceipts,
  listSubscriptions,
  listChargesForSubscription,
  toMonthlyCents,
} from '@lighthouse/core';

interface ExportOpts {
  out: string;
}

function escapeCsv(s: string): string {
  if (/[,"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export async function exportCommand(opts: ExportOpts): Promise<void> {
  getDb();
  const dir = resolve(opts.out);
  mkdirSync(dir, { recursive: true });

  // Receipts CSV.
  const allReceipts = listReceipts({ limit: 100_000 }).rows;
  const csvLines = ['date,merchant,total,currency,order_number,payment_method,confidence,line_items'];
  for (const r of allReceipts) {
    const date = new Date(r.transaction_date).toISOString().slice(0, 10);
    const total = (r.total_amount_cents / 100).toFixed(2);
    const items = r.line_items_json ?? '';
    csvLines.push(
      [
        date,
        escapeCsv(r.merchant_display_name),
        total,
        r.currency,
        escapeCsv(r.order_number ?? ''),
        escapeCsv(r.payment_method ?? ''),
        r.confidence.toFixed(2),
        escapeCsv(items),
      ].join(','),
    );
  }
  const csvPath = join(dir, 'receipts.csv');
  writeFileSync(csvPath, csvLines.join('\n'));

  // Subscriptions JSON.
  const subs = listSubscriptions().map((s) => ({
    merchant: s.merchant_display_name,
    plan_name: s.plan_name,
    amount: (s.amount_cents / 100).toFixed(2),
    currency: s.currency,
    billing_cycle: s.billing_cycle,
    monthly_cost: (toMonthlyCents(s.amount_cents, s.billing_cycle) / 100).toFixed(2),
    status: s.status,
    next_renewal_date: s.next_renewal_date
      ? new Date(s.next_renewal_date).toISOString().slice(0, 10)
      : null,
    trial_end_date: s.trial_end_date
      ? new Date(s.trial_end_date).toISOString().slice(0, 10)
      : null,
    charges: listChargesForSubscription(s.id).map((c) => ({
      date: new Date(c.charge_date).toISOString().slice(0, 10),
      amount: (c.amount_cents / 100).toFixed(2),
      currency: c.currency,
    })),
  }));
  const jsonPath = join(dir, 'subscriptions.json');
  writeFileSync(jsonPath, JSON.stringify(subs, null, 2));

  console.log(chalk.green('✓ Export complete.'));
  console.log(chalk.gray(`  ${csvPath}    ${allReceipts.length} receipts`));
  console.log(chalk.gray(`  ${jsonPath}   ${subs.length} subscriptions`));
}
