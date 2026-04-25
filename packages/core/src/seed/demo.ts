/**
 * Demo seed.
 *
 * Populates a fresh SQLite DB with ~200 fake-but-plausible emails →
 * receipts → subscriptions, so anyone can `npm run seed:demo && npm run serve`
 * and immediately see the dashboard rendered with real-looking data, even
 * without Gmail/LLM credentials.
 */
import { randomBytes } from 'node:crypto';
import {
  getDb,
  insertEmail,
  insertReceipt,
  insertSubscriptionCharge,
  upsertMerchant,
  upsertSubscription,
  log,
} from '../index.js';
import { runAlertsPass } from '../domain/alerts.js';

interface FakeMerchant {
  canonical: string;
  display: string;
  domain: string;
  category: string;
  amount: number; // typical line item / charge cents
}

const MERCHANTS: FakeMerchant[] = [
  { canonical: 'amazon', display: 'Amazon', domain: 'amazon.com', category: 'shopping', amount: 4299 },
  { canonical: 'netflix', display: 'Netflix', domain: 'netflix.com', category: 'streaming', amount: 1599 },
  { canonical: 'spotify', display: 'Spotify', domain: 'spotify.com', category: 'streaming', amount: 1099 },
  { canonical: 'apple', display: 'Apple', domain: 'apple.com', category: 'apps', amount: 999 },
  { canonical: 'doordash', display: 'DoorDash', domain: 'doordash.com', category: 'food', amount: 2877 },
  { canonical: 'uber', display: 'Uber', domain: 'uber.com', category: 'transit', amount: 1612 },
  { canonical: 'github', display: 'GitHub', domain: 'github.com', category: 'developer', amount: 2100 },
  { canonical: 'figma', display: 'Figma', domain: 'figma.com', category: 'developer', amount: 1500 },
  { canonical: 'notion', display: 'Notion', domain: 'notion.so', category: 'productivity', amount: 1000 },
  { canonical: 'nytimes', display: 'The New York Times', domain: 'nytimes.com', category: 'news', amount: 1700 },
  { canonical: 'starbucks', display: 'Starbucks', domain: 'starbucks.com', category: 'food', amount: 642 },
  { canonical: 'airbnb', display: 'Airbnb', domain: 'airbnb.com', category: 'travel', amount: 18900 },
  { canonical: 'openai', display: 'OpenAI', domain: 'openai.com', category: 'developer', amount: 2000 },
  { canonical: 'anthropic', display: 'Anthropic', domain: 'anthropic.com', category: 'developer', amount: 2000 },
  { canonical: 'peloton', display: 'Peloton', domain: 'onepeloton.com', category: 'fitness', amount: 4400 },
  { canonical: 'classpass', display: 'ClassPass', domain: 'classpass.com', category: 'fitness', amount: 7900 },
];

interface SubscriptionDef {
  merchant: string;
  plan: string;
  amount: number;
  cycle: 'monthly' | 'annually' | 'weekly' | 'quarterly';
  trial?: boolean;
}

const SUBSCRIPTIONS: SubscriptionDef[] = [
  { merchant: 'netflix', plan: 'Premium', amount: 2299, cycle: 'monthly' },
  { merchant: 'spotify', plan: 'Family', amount: 1699, cycle: 'monthly' },
  { merchant: 'apple', plan: 'iCloud+ 200GB', amount: 299, cycle: 'monthly' },
  { merchant: 'github', plan: 'Pro', amount: 2100, cycle: 'monthly' },
  { merchant: 'figma', plan: 'Professional', amount: 1500, cycle: 'monthly' },
  { merchant: 'notion', plan: 'Plus', amount: 1000, cycle: 'monthly' },
  { merchant: 'nytimes', plan: 'All Access', amount: 1700, cycle: 'monthly' },
  { merchant: 'openai', plan: 'ChatGPT Plus', amount: 2000, cycle: 'monthly' },
  { merchant: 'anthropic', plan: 'Claude Pro', amount: 2000, cycle: 'monthly', trial: true },
  { merchant: 'peloton', plan: 'All-Access Membership', amount: 4400, cycle: 'monthly' },
  { merchant: 'classpass', plan: '8 Credits', amount: 7900, cycle: 'monthly' },
];

const DAY = 24 * 60 * 60 * 1000;
const MONTH = 30 * DAY;

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomId(): string {
  return randomBytes(8).toString('hex');
}

function emailBodyForReceipt(m: FakeMerchant, amount: number, dateMs: number): string {
  const d = new Date(dateMs).toISOString().slice(0, 10);
  return `Thanks for your order!

Order #${randomId().toUpperCase()} placed on ${d}.

Total: $${(amount / 100).toFixed(2)} USD
Payment method: Visa ending in ${rand(1000, 9999)}

If you have any questions, reach out to support.

— The ${m.display} Team`;
}

function emailBodyForRenewal(s: SubscriptionDef, dateMs: number): string {
  const d = new Date(dateMs).toISOString().slice(0, 10);
  const next = new Date(dateMs + MONTH).toISOString().slice(0, 10);
  return `Your ${s.plan} subscription has been renewed.

Date: ${d}
Amount: $${(s.amount / 100).toFixed(2)} USD
Next renewal: ${next}

Thanks for your continued support.`;
}

function emailBodyForTrial(s: SubscriptionDef, endMs: number): string {
  const d = new Date(endMs).toISOString().slice(0, 10);
  return `Your free trial of ${s.plan} ends on ${d}.

After that, you'll be charged $${(s.amount / 100).toFixed(2)} per month
until you cancel.`;
}

function maybe<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export async function seedDemo(): Promise<void> {
  const db = getDb();
  log.info('Seeding demo data...');

  // Wipe the data tables (not migrations).
  db.exec(`
    DELETE FROM alerts;
    DELETE FROM subscription_charges;
    DELETE FROM subscriptions;
    DELETE FROM receipts;
    DELETE FROM emails;
    DELETE FROM merchants;
    DELETE FROM merchant_alias_cache;
    DELETE FROM classification_cache;
  `);

  const now = Date.now();
  const merchantIds = new Map<string, number>();
  for (const m of MERCHANTS) {
    const id = upsertMerchant({
      canonical_name: m.canonical,
      display_name: m.display,
      domain: m.domain,
      category: m.category,
    });
    merchantIds.set(m.canonical, id);
  }

  // 1. Subscriptions: create the rows + 12 monthly charges each.
  for (const s of SUBSCRIPTIONS) {
    const m = MERCHANTS.find((x) => x.canonical === s.merchant)!;
    const merchantId = merchantIds.get(s.merchant)!;
    const months = s.trial ? 1 : 12 + rand(0, 6);
    const subId = upsertSubscription({
      merchant_id: merchantId,
      plan_name: s.plan,
      amount_cents: s.amount,
      currency: 'USD',
      billing_cycle: s.cycle,
      status: s.trial ? 'trial' : 'active',
      next_renewal_date: now + MONTH,
      trial_end_date: s.trial ? now + 5 * DAY : null,
    });

    for (let i = 0; i < months; i++) {
      const dateMs = now - i * MONTH - rand(0, 2 * DAY);
      const emailId = insertEmail({
        gmail_message_id: 'demo-' + randomId(),
        gmail_thread_id: 'demo-thread-' + randomId(),
        internal_date: dateMs,
        from_address: `billing@${m.domain}`,
        from_name: `${m.display} Billing`,
        subject: s.trial ? `Welcome to your ${s.plan} trial` : `${s.plan} renewal — receipt`,
        snippet: s.trial ? 'Your free trial' : `$${(s.amount / 100).toFixed(2)} renewal`,
        body_text: s.trial ? emailBodyForTrial(s, now + 5 * DAY) : emailBodyForRenewal(s, dateMs),
        body_html: null,
        raw_headers_json: null,
        fetched_at: now,
      });
      if (!emailId) continue;
      // Mark the email as processed so it doesn't show up as pending later.
      db.prepare(
        `UPDATE emails SET processed_status='done', classification=?, processed_at=? WHERE id=?`,
      ).run(s.trial ? 'trial_started' : 'subscription_renewal', now, emailId);

      // Add a "price increase" hiccup for OpenAI to demo alerts.
      const amount = s.merchant === 'openai' && i === 0 ? Math.round(s.amount * 1.1) : s.amount;

      if (!s.trial) {
        const receiptId = insertReceipt({
          email_id: emailId,
          merchant_id: merchantId,
          total_amount_cents: amount,
          currency: 'USD',
          transaction_date: dateMs,
          line_items_json: JSON.stringify([
            { description: s.plan, quantity: 1, unit_price_cents: amount, total_cents: amount },
          ]),
          order_number: 'INV-' + randomId().toUpperCase(),
          payment_method: 'Visa ending in 4242',
          confidence: 0.95,
          extraction_model: 'demo-seed',
          raw_extraction_json: null,
        });
        insertSubscriptionCharge({
          subscription_id: subId,
          receipt_id: receiptId,
          charge_date: dateMs,
          amount_cents: amount,
          currency: 'USD',
        });
      }
    }
  }

  // 2. One-off receipts for shopping merchants.
  const shopping = MERCHANTS.filter((m) =>
    ['shopping', 'food', 'transit', 'travel'].includes(m.category),
  );
  const oneOffEmails = 200 - SUBSCRIPTIONS.reduce((acc) => acc + 12, 0);
  for (let i = 0; i < oneOffEmails; i++) {
    const m = maybe(shopping);
    const dateMs = now - rand(0, 24) * MONTH - rand(0, 28) * DAY;
    const amount = Math.max(199, Math.round(m.amount * (0.5 + Math.random() * 1.5)));
    const merchantId = merchantIds.get(m.canonical)!;
    const emailId = insertEmail({
      gmail_message_id: 'demo-' + randomId(),
      gmail_thread_id: 'demo-thread-' + randomId(),
      internal_date: dateMs,
      from_address: `orders@${m.domain}`,
      from_name: `${m.display} Orders`,
      subject: `Your ${m.display} order receipt`,
      snippet: `$${(amount / 100).toFixed(2)} — order confirmation`,
      body_text: emailBodyForReceipt(m, amount, dateMs),
      body_html: null,
      raw_headers_json: null,
      fetched_at: now,
    });
    if (!emailId) continue;
    db.prepare(
      `UPDATE emails SET processed_status='done', classification='receipt', processed_at=? WHERE id=?`,
    ).run(now, emailId);
    insertReceipt({
      email_id: emailId,
      merchant_id: merchantId,
      total_amount_cents: amount,
      currency: 'USD',
      transaction_date: dateMs,
      line_items_json: null,
      order_number: 'ORD-' + randomId().toUpperCase(),
      payment_method: 'Visa ending in 4242',
      confidence: 0.92,
      extraction_model: 'demo-seed',
      raw_extraction_json: null,
    });
  }

  // 3. Run alerts so the demo dashboard has something interesting.
  runAlertsPass();
  log.info('Seed complete.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDemo()
    .then(() => process.exit(0))
    .catch((e: unknown) => {
      console.error(e);
      process.exit(1);
    });
}
