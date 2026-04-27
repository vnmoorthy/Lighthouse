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
  getMerchantById,
  listMerchants,
  listReceipts,
  listSubscriptions,
  listChargesForSubscription,
  toMonthlyCents,
} from '@lighthouse/core';
import { renderReceipts, type ExportFormat } from './export_formats.js';

interface ExportOpts {
  out: string;
  taxOnly?: boolean;
  format?: ExportFormat;
}

function escapeCsv(s: string): string {
  if (/[,"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// IRS-friendly business categories. Anything outside is excluded when
// --tax-only is passed. (Calibrated for US Schedule C / typical sole
// proprietor categories; international users should adjust.)
const TAX_DEDUCTIBLE_CATEGORIES = new Set([
  'developer',
  'cloud',
  'productivity',
  'utilities',
  'travel',
  'transit',
  'apps',
]);

export async function exportCommand(opts: ExportOpts): Promise<void> {
  getDb();
  const dir = resolve(opts.out);
  mkdirSync(dir, { recursive: true });

  const format: ExportFormat = (opts.format ?? 'lighthouse') as ExportFormat;

  // Pull receipts + merchant metadata.
  const allReceipts = listReceipts({ limit: 100_000 }).rows;
  const merchantList = listMerchants();
  const merchantMap = new Map(merchantList.map((m) => [m.id, m]));

  // Tax filter only applies to the lighthouse-native CSV.
  const filtered = allReceipts.filter((r) => {
    if (!opts.taxOnly) return true;
    const merchant = getMerchantById(r.merchant_id);
    return TAX_DEDUCTIBLE_CATEGORIES.has(merchant?.category ?? 'other');
  });

  const rendered = renderReceipts(
    filtered.map((r) => ({ ...r, category: merchantMap.get(r.merchant_id)?.category ?? null })),
    merchantMap,
    format,
  );
  const csvPath = join(dir, opts.taxOnly && format === 'lighthouse' ? 'receipts-tax.csv' : rendered.filename);
  writeFileSync(csvPath, rendered.content);
  const included = filtered.length;
  void escapeCsv;

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
  console.log(chalk.gray(`  ${csvPath}    ${included} receipts${opts.taxOnly ? ' (tax-deductible only)' : ''}`));
  console.log(chalk.gray(`  ${jsonPath}   ${subs.length} subscriptions`));
}
