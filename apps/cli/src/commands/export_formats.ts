/**
 * Export adapters: render the receipts table into the shape that other
 * personal-finance tools want.
 *
 * Supported formats:
 *   - ynab        — YNAB CSV import (Date, Payee, Memo, Outflow, Inflow)
 *   - lunchmoney  — Lunch Money JSON import shape
 *   - beancount   — Plain-text Beancount transactions
 */
import type { ReceiptRow, MerchantRow } from '@lighthouse/core';

export interface RowWithMerchant extends ReceiptRow {
  merchant_display_name: string;
  merchant_domain: string | null;
  category?: string | null;
}

export type ExportFormat = 'lighthouse' | 'ynab' | 'lunchmoney' | 'beancount';

export function renderReceipts(
  rows: RowWithMerchant[],
  merchants: Map<number, MerchantRow>,
  format: ExportFormat,
): { filename: string; content: string } {
  switch (format) {
    case 'ynab':
      return { filename: 'receipts-ynab.csv', content: renderYnab(rows) };
    case 'lunchmoney':
      return { filename: 'receipts-lunchmoney.json', content: renderLunchMoney(rows, merchants) };
    case 'beancount':
      return { filename: 'receipts.beancount', content: renderBeancount(rows, merchants) };
    case 'lighthouse':
    default:
      return { filename: 'receipts.csv', content: renderLighthouseCsv(rows, merchants) };
  }
}

function escCsv(s: string): string {
  if (/[,"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function renderYnab(rows: RowWithMerchant[]): string {
  // YNAB requires: Date,Payee,Memo,Outflow,Inflow
  const lines = ['Date,Payee,Memo,Outflow,Inflow'];
  for (const r of rows) {
    const date = new Date(r.transaction_date).toISOString().slice(0, 10);
    const payee = escCsv(r.merchant_display_name);
    const memo = escCsv(r.order_number ?? '');
    const cents = r.total_amount_cents;
    const outflow = cents > 0 ? (cents / 100).toFixed(2) : '';
    const inflow = cents < 0 ? (Math.abs(cents) / 100).toFixed(2) : '';
    lines.push([date, payee, memo, outflow, inflow].join(','));
  }
  return lines.join('\n');
}

function renderLunchMoney(rows: RowWithMerchant[], merchants: Map<number, MerchantRow>): string {
  const out = rows.map((r) => {
    const m = merchants.get(r.merchant_id);
    return {
      date: new Date(r.transaction_date).toISOString().slice(0, 10),
      amount: (r.total_amount_cents / 100).toFixed(2),
      currency: r.currency.toLowerCase(),
      payee: r.merchant_display_name,
      category: m?.category ?? 'other',
      notes: r.order_number ?? null,
      external_id: `lighthouse-${r.id}`,
    };
  });
  return JSON.stringify(out, null, 2);
}

function renderBeancount(rows: RowWithMerchant[], merchants: Map<number, MerchantRow>): string {
  const lines: string[] = [
    ';; Lighthouse export — Beancount format',
    ';; Accounts auto-generated from category (Expenses:Food etc.).',
    '',
    'option "title" "Lighthouse — receipts"',
    'option "operating_currency" "USD"',
    '',
  ];
  // Open accounts on first use.
  const openedExp = new Set<string>();
  const openedAsset = new Set<string>();
  // Sort by date ascending for cleaner output.
  const sorted = [...rows].sort((a, b) => a.transaction_date - b.transaction_date);
  for (const r of sorted) {
    const date = new Date(r.transaction_date).toISOString().slice(0, 10);
    const m = merchants.get(r.merchant_id);
    const cat = (m?.category ?? 'other')
      .split(/[-_]/)
      .map((s) => s[0]!.toUpperCase() + s.slice(1))
      .join('');
    const expenseAccount = `Expenses:${cat || 'Other'}`;
    const assetAccount = `Assets:Cash`;
    if (!openedExp.has(expenseAccount)) {
      lines.push(`${date} open ${expenseAccount}`);
      openedExp.add(expenseAccount);
    }
    if (!openedAsset.has(assetAccount)) {
      lines.push(`${date} open ${assetAccount}`);
      openedAsset.add(assetAccount);
    }
    const amount = (r.total_amount_cents / 100).toFixed(2);
    const ccy = r.currency.toUpperCase();
    lines.push('');
    lines.push(`${date} * "${r.merchant_display_name}" "${r.order_number ?? ''}"`);
    lines.push(`  ${expenseAccount}    ${amount} ${ccy}`);
    lines.push(`  ${assetAccount}    -${amount} ${ccy}`);
  }
  return lines.join('\n') + '\n';
}

function renderLighthouseCsv(rows: RowWithMerchant[], merchants: Map<number, MerchantRow>): string {
  const lines = [
    'date,merchant,category,total,currency,order_number,payment_method,confidence,line_items',
  ];
  for (const r of rows) {
    const m = merchants.get(r.merchant_id);
    const date = new Date(r.transaction_date).toISOString().slice(0, 10);
    const total = (r.total_amount_cents / 100).toFixed(2);
    const items = r.line_items_json ?? '';
    lines.push(
      [
        date,
        escCsv(r.merchant_display_name),
        m?.category ?? 'other',
        total,
        r.currency,
        escCsv(r.order_number ?? ''),
        escCsv(r.payment_method ?? ''),
        r.confidence.toFixed(2),
        escCsv(items),
      ].join(','),
    );
  }
  return lines.join('\n');
}
