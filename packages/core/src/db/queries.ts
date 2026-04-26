/**
 * Query helpers — typed wrappers around prepared statements.
 *
 * Pattern: each query returns plain row objects (or arrays of them) with the
 * SQLite-native shape. Mapping into richer "view" objects (e.g. resolving
 * merchant joins) happens in api/handlers.ts. Keeping the SQL layer dumb
 * makes the file easy to grep.
 */
import { getDb, tx } from './index.js';
import type {
  EmailRow,
  MerchantRow,
  ReceiptRow,
  SubscriptionRow,
  SubscriptionChargeRow,
  AlertRow,
  SyncRunRow,
  ProcessedStatus,
  EmailClass,
  AlertType,
} from '../domain/types.js';

// --- Emails ----------------------------------------------------------------

export function insertEmail(
  e: Omit<EmailRow, 'id' | 'processed_status' | 'processed_at' | 'classification' | 'error_message'>,
): number | null {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO emails (
      gmail_message_id, gmail_thread_id, internal_date,
      from_address, from_name, subject, snippet,
      body_text, body_html, raw_headers_json, fetched_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(gmail_message_id) DO NOTHING
  `);
  const r = stmt.run(
    e.gmail_message_id,
    e.gmail_thread_id,
    e.internal_date,
    e.from_address,
    e.from_name,
    e.subject,
    e.snippet,
    e.body_text,
    e.body_html,
    e.raw_headers_json,
    e.fetched_at,
  );
  return r.changes > 0 ? Number(r.lastInsertRowid) : null;
}

export function getEmailById(id: number): EmailRow | null {
  return (getDb().prepare('SELECT * FROM emails WHERE id = ?').get(id) as EmailRow | undefined) ?? null;
}

export function getPendingEmails(limit: number): EmailRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM emails WHERE processed_status = 'pending'
       ORDER BY internal_date DESC LIMIT ?`,
    )
    .all(limit) as EmailRow[];
}

export function markEmailClassified(
  id: number,
  classification: EmailClass,
  status: ProcessedStatus = 'classified',
): void {
  getDb()
    .prepare(
      'UPDATE emails SET classification = ?, processed_status = ?, processed_at = ? WHERE id = ?',
    )
    .run(classification, status, Date.now(), id);
}

export function markEmailDone(id: number): void {
  getDb()
    .prepare('UPDATE emails SET processed_status = ?, processed_at = ? WHERE id = ?')
    .run('done', Date.now(), id);
}

export function markEmailError(id: number, message: string): void {
  getDb()
    .prepare(
      'UPDATE emails SET processed_status = ?, processed_at = ?, error_message = ? WHERE id = ?',
    )
    .run('error', Date.now(), message.slice(0, 1000), id);
}

export function markEmailSkipped(id: number, reason: string): void {
  getDb()
    .prepare(
      'UPDATE emails SET processed_status = ?, processed_at = ?, error_message = ? WHERE id = ?',
    )
    .run('skipped', Date.now(), reason.slice(0, 200), id);
}

export function countEmailsByStatus(): Record<ProcessedStatus, number> {
  const rows = getDb()
    .prepare('SELECT processed_status as s, COUNT(*) as n FROM emails GROUP BY processed_status')
    .all() as { s: ProcessedStatus; n: number }[];
  const out = { pending: 0, classified: 0, done: 0, error: 0, skipped: 0 } as Record<
    ProcessedStatus,
    number
  >;
  for (const r of rows) out[r.s] = r.n;
  return out;
}

// --- Merchants -------------------------------------------------------------

export function upsertMerchant(m: {
  canonical_name: string;
  display_name: string;
  domain: string | null;
  category?: string | null;
}): number {
  return tx(() => {
    const existing = getDb()
      .prepare('SELECT id FROM merchants WHERE canonical_name = ?')
      .get(m.canonical_name) as { id: number } | undefined;
    if (existing) return existing.id;
    const r = getDb()
      .prepare(
        `INSERT INTO merchants (canonical_name, display_name, domain, category, created_at)
         VALUES (?,?,?,?,?)`,
      )
      .run(m.canonical_name, m.display_name, m.domain, m.category ?? null, Date.now());
    return Number(r.lastInsertRowid);
  });
}

export function getMerchantById(id: number): MerchantRow | null {
  return (getDb().prepare('SELECT * FROM merchants WHERE id = ?').get(id) as
    | MerchantRow
    | undefined) ?? null;
}

export function listMerchants(): MerchantRow[] {
  return getDb().prepare('SELECT * FROM merchants ORDER BY display_name').all() as MerchantRow[];
}

// --- Receipts --------------------------------------------------------------

export function insertReceipt(r: Omit<ReceiptRow, 'id' | 'created_at'>): number {
  const res = getDb()
    .prepare(
      `INSERT INTO receipts (
        email_id, merchant_id, total_amount_cents, currency, transaction_date,
        line_items_json, order_number, payment_method, confidence,
        extraction_model, raw_extraction_json, created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(email_id) DO UPDATE SET
        merchant_id = excluded.merchant_id,
        total_amount_cents = excluded.total_amount_cents,
        currency = excluded.currency,
        transaction_date = excluded.transaction_date,
        line_items_json = excluded.line_items_json,
        order_number = excluded.order_number,
        payment_method = excluded.payment_method,
        confidence = excluded.confidence`,
    )
    .run(
      r.email_id,
      r.merchant_id,
      r.total_amount_cents,
      r.currency,
      r.transaction_date,
      r.line_items_json,
      r.order_number,
      r.payment_method,
      r.confidence,
      r.extraction_model,
      r.raw_extraction_json,
      Date.now(),
    );
  return Number(res.lastInsertRowid);
}

export interface ReceiptListFilter {
  from?: number | null;
  to?: number | null;
  merchantId?: number | null;
  category?: string | null;
  tag?: string | null;
  q?: string | null;
  limit?: number;
  offset?: number;
}

export function listReceipts(f: ReceiptListFilter = {}): {
  rows: (ReceiptRow & { merchant_display_name: string; merchant_domain: string | null })[];
  total: number;
} {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.from != null) { where.push('r.transaction_date >= ?'); params.push(f.from); }
  if (f.to != null) { where.push('r.transaction_date <= ?'); params.push(f.to); }
  if (f.merchantId != null) { where.push('r.merchant_id = ?'); params.push(f.merchantId); }
  if (f.category) { where.push('m.category = ?'); params.push(f.category); }
  if (f.tag) {
    where.push('r.id IN (SELECT receipt_id FROM receipt_tags WHERE tag = ?)');
    params.push(f.tag);
  }
  if (f.q) {
    where.push('(LOWER(m.display_name) LIKE ? OR LOWER(r.order_number) LIKE ?)');
    const q = `%${f.q.toLowerCase()}%`;
    params.push(q, q);
  }
  const W = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.max(1, Math.min(500, f.limit ?? 50));
  const offset = Math.max(0, f.offset ?? 0);

  const total = (getDb()
    .prepare(`SELECT COUNT(*) as n FROM receipts r JOIN merchants m ON m.id = r.merchant_id ${W}`)
    .get(...params) as { n: number }).n;

  const rows = getDb()
    .prepare(
      `SELECT r.*, m.display_name as merchant_display_name, m.domain as merchant_domain
       FROM receipts r JOIN merchants m ON m.id = r.merchant_id
       ${W}
       ORDER BY r.transaction_date DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as (ReceiptRow & {
    merchant_display_name: string;
    merchant_domain: string | null;
  })[];
  return { rows, total };
}

export function getReceiptById(
  id: number,
): (ReceiptRow & { merchant_display_name: string; merchant_domain: string | null }) | null {
  return (
    (getDb()
      .prepare(
        `SELECT r.*, m.display_name as merchant_display_name, m.domain as merchant_domain
         FROM receipts r JOIN merchants m ON m.id = r.merchant_id WHERE r.id = ?`,
      )
      .get(id) as
      | (ReceiptRow & { merchant_display_name: string; merchant_domain: string | null })
      | undefined) ?? null
  );
}

// --- Receipt tags ----------------------------------------------------------

export function addReceiptTags(receiptId: number, tags: string[]): void {
  if (tags.length === 0) return;
  const stmt = getDb().prepare(
    `INSERT INTO receipt_tags (receipt_id, tag, created_at) VALUES (?, ?, ?)
     ON CONFLICT (receipt_id, tag) DO NOTHING`,
  );
  const now = Date.now();
  return tx(() => {
    for (const t of tags) {
      const clean = normalizeTag(t);
      if (clean) stmt.run(receiptId, clean, now);
    }
  });
}

export function removeReceiptTag(receiptId: number, tag: string): void {
  getDb()
    .prepare('DELETE FROM receipt_tags WHERE receipt_id = ? AND tag = ?')
    .run(receiptId, normalizeTag(tag));
}

export function getReceiptTags(receiptId: number): string[] {
  const rows = getDb()
    .prepare('SELECT tag FROM receipt_tags WHERE receipt_id = ? ORDER BY tag')
    .all(receiptId) as { tag: string }[];
  return rows.map((r) => r.tag);
}

export function listAllTagsWithCounts(): { tag: string; count: number }[] {
  return getDb()
    .prepare('SELECT tag, COUNT(*) as count FROM receipt_tags GROUP BY tag ORDER BY count DESC')
    .all() as { tag: string; count: number }[];
}

function normalizeTag(t: string): string {
  return t.toLowerCase().trim().replace(/\s+/g, '-').slice(0, 32);
}

// --- Subscriptions ---------------------------------------------------------

export function upsertSubscription(s: {
  merchant_id: number;
  plan_name: string | null;
  amount_cents: number;
  currency: string;
  billing_cycle: SubscriptionRow['billing_cycle'];
  status?: SubscriptionRow['status'];
  next_renewal_date?: number | null;
  trial_end_date?: number | null;
  first_seen_email_id?: number | null;
  last_seen_email_id?: number | null;
}): number {
  return tx(() => {
    const existing = getDb()
      .prepare(
        `SELECT id FROM subscriptions
         WHERE merchant_id = ? AND billing_cycle = ? AND amount_cents = ? AND currency = ?`,
      )
      .get(s.merchant_id, s.billing_cycle, s.amount_cents, s.currency) as
      | { id: number }
      | undefined;
    const now = Date.now();
    if (existing) {
      getDb()
        .prepare(
          `UPDATE subscriptions SET
            plan_name = COALESCE(?, plan_name),
            status = COALESCE(?, status),
            next_renewal_date = COALESCE(?, next_renewal_date),
            trial_end_date = COALESCE(?, trial_end_date),
            last_seen_email_id = COALESCE(?, last_seen_email_id),
            updated_at = ?
           WHERE id = ?`,
        )
        .run(
          s.plan_name,
          s.status ?? null,
          s.next_renewal_date ?? null,
          s.trial_end_date ?? null,
          s.last_seen_email_id ?? null,
          now,
          existing.id,
        );
      return existing.id;
    }
    const r = getDb()
      .prepare(
        `INSERT INTO subscriptions (
          merchant_id, plan_name, amount_cents, currency, billing_cycle,
          next_renewal_date, first_seen_email_id, last_seen_email_id, status,
          trial_end_date, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        s.merchant_id,
        s.plan_name,
        s.amount_cents,
        s.currency,
        s.billing_cycle,
        s.next_renewal_date ?? null,
        s.first_seen_email_id ?? null,
        s.last_seen_email_id ?? null,
        s.status ?? 'active',
        s.trial_end_date ?? null,
        now,
        now,
      );
    return Number(r.lastInsertRowid);
  });
}

export function listSubscriptions(
  status?: SubscriptionRow['status'],
): (SubscriptionRow & { merchant_display_name: string; merchant_domain: string | null })[] {
  const W = status ? 'WHERE s.status = ?' : '';
  const params = status ? [status] : [];
  return getDb()
    .prepare(
      `SELECT s.*, m.display_name as merchant_display_name, m.domain as merchant_domain
       FROM subscriptions s JOIN merchants m ON m.id = s.merchant_id
       ${W}
       ORDER BY s.amount_cents DESC`,
    )
    .all(...params) as (SubscriptionRow & {
    merchant_display_name: string;
    merchant_domain: string | null;
  })[];
}

export function getSubscriptionById(
  id: number,
): (SubscriptionRow & { merchant_display_name: string; merchant_domain: string | null }) | null {
  return (
    (getDb()
      .prepare(
        `SELECT s.*, m.display_name as merchant_display_name, m.domain as merchant_domain
         FROM subscriptions s JOIN merchants m ON m.id = s.merchant_id WHERE s.id = ?`,
      )
      .get(id) as
      | (SubscriptionRow & { merchant_display_name: string; merchant_domain: string | null })
      | undefined) ?? null
  );
}

export function setSubscriptionStatus(id: number, status: SubscriptionRow['status']): void {
  getDb()
    .prepare('UPDATE subscriptions SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, Date.now(), id);
}

// --- Subscription charges --------------------------------------------------

export function insertSubscriptionCharge(
  c: Omit<SubscriptionChargeRow, 'id'>,
): number | null {
  const r = getDb()
    .prepare(
      `INSERT INTO subscription_charges (subscription_id, receipt_id, charge_date, amount_cents, currency)
       VALUES (?,?,?,?,?)
       ON CONFLICT(receipt_id) WHERE receipt_id IS NOT NULL DO NOTHING`,
    )
    .run(c.subscription_id, c.receipt_id, c.charge_date, c.amount_cents, c.currency);
  return r.changes > 0 ? Number(r.lastInsertRowid) : null;
}

export function listChargesForSubscription(subId: number): SubscriptionChargeRow[] {
  return getDb()
    .prepare('SELECT * FROM subscription_charges WHERE subscription_id = ? ORDER BY charge_date DESC')
    .all(subId) as SubscriptionChargeRow[];
}

// --- Alerts ----------------------------------------------------------------

export function insertAlert(a: {
  type: AlertType;
  subject_id: number;
  subject_table: string;
  payload: unknown;
}): number | null {
  // Don't re-create alerts of the same type for the same subject within 30d.
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const dup = getDb()
    .prepare(
      `SELECT id FROM alerts WHERE type = ? AND subject_id = ? AND subject_table = ?
       AND created_at > ? AND dismissed_at IS NULL`,
    )
    .get(a.type, a.subject_id, a.subject_table, cutoff) as { id: number } | undefined;
  if (dup) return null;
  const now = Date.now();
  const r = getDb()
    .prepare(
      `INSERT INTO alerts (type, subject_id, subject_table, payload_json, created_at)
       VALUES (?,?,?,?,?)`,
    )
    .run(a.type, a.subject_id, a.subject_table, JSON.stringify(a.payload), now);
  // Fire-and-forget webhook + native notification. Lazy-loaded to dodge
  // a circular import through the domain index.
  const payload = a.payload as Record<string, unknown> | null;
  const merchantHint =
    payload && typeof payload === 'object' && payload['merchant']
      ? String(payload['merchant'])
      : null;
  const titleByType: Record<string, string> = {
    trial_ending: 'Trial ending',
    price_increase: 'Price change',
    new_subscription: 'New subscription',
    duplicate_charge: 'Duplicate charge',
    custom: 'Custom alert',
  };
  void import('../domain/webhooks.js')
    .then(({ dispatchWebhook }) =>
      dispatchWebhook({
        type: 'alert',
        alert_type: a.type,
        subject_table: a.subject_table,
        subject_id: a.subject_id,
        payload: a.payload,
        created_at: now,
        source: 'lighthouse',
        version: '0.25.0',
      }),
    )
    .catch(() => {
      /* non-fatal */
    });
  void import('../domain/notifications.js')
    .then(({ notify }) =>
      notify(
        titleByType[a.type] ?? a.type,
        merchantHint ?? `${a.subject_table} #${a.subject_id}`,
      ),
    )
    .catch(() => {
      /* non-fatal */
    });
  return Number(r.lastInsertRowid);
}

export function listOpenAlerts(): AlertRow[] {
  return getDb()
    .prepare('SELECT * FROM alerts WHERE dismissed_at IS NULL ORDER BY created_at DESC')
    .all() as AlertRow[];
}

export function dismissAlert(id: number): void {
  getDb().prepare('UPDATE alerts SET dismissed_at = ? WHERE id = ?').run(Date.now(), id);
}

// --- Sync runs -------------------------------------------------------------

export function startSyncRun(): number {
  const r = getDb()
    .prepare(`INSERT INTO sync_runs (started_at, status) VALUES (?, 'running')`)
    .run(Date.now());
  return Number(r.lastInsertRowid);
}

export function updateSyncRun(
  id: number,
  patch: Partial<Pick<SyncRunRow, 'emails_fetched' | 'emails_processed' | 'errors_json'>>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    sets.push(`${k} = ?`);
    params.push(v);
  }
  if (sets.length === 0) return;
  params.push(id);
  getDb().prepare(`UPDATE sync_runs SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}

export function finishSyncRun(id: number, status: 'finished' | 'failed'): void {
  getDb()
    .prepare('UPDATE sync_runs SET finished_at = ?, status = ? WHERE id = ?')
    .run(Date.now(), status, id);
}

export function getSyncRun(id: number): SyncRunRow | null {
  return (
    (getDb().prepare('SELECT * FROM sync_runs WHERE id = ?').get(id) as SyncRunRow | undefined) ??
    null
  );
}

export function getLatestSyncRun(): SyncRunRow | null {
  return (
    (getDb()
      .prepare('SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 1')
      .get() as SyncRunRow | undefined) ?? null
  );
}

// --- Classification cache --------------------------------------------------

export function getClassificationCache(hash: string): EmailClass | null {
  const row = getDb().prepare('SELECT result FROM classification_cache WHERE hash = ?').get(hash) as
    | { result: EmailClass }
    | undefined;
  return row?.result ?? null;
}

export function putClassificationCache(hash: string, result: EmailClass): void {
  getDb()
    .prepare(
      `INSERT INTO classification_cache (hash, result, created_at) VALUES (?,?,?)
       ON CONFLICT(hash) DO UPDATE SET result = excluded.result`,
    )
    .run(hash, result, Date.now());
}

// --- Merchant alias cache --------------------------------------------------

export function getMerchantAlias(rawString: string, fromDomain: string): number | null {
  const row = getDb()
    .prepare(
      'SELECT merchant_id FROM merchant_alias_cache WHERE raw_string = ? AND from_domain = ?',
    )
    .get(rawString, fromDomain) as { merchant_id: number } | undefined;
  return row?.merchant_id ?? null;
}

export function putMerchantAlias(rawString: string, fromDomain: string, merchantId: number): void {
  getDb()
    .prepare(
      `INSERT INTO merchant_alias_cache (raw_string, from_domain, merchant_id, created_at)
       VALUES (?,?,?,?)
       ON CONFLICT(raw_string, from_domain) DO UPDATE SET merchant_id = excluded.merchant_id`,
    )
    .run(rawString, fromDomain, merchantId, Date.now());
}

// --- Summary aggregation ---------------------------------------------------

export interface SummaryByMonth {
  month: string; // YYYY-MM
  total_cents: number;
  count: number;
}

export interface SubscriptionHealth {
  total_active: number;
  total_trial: number;
  total_cancelled: number;
  monthly_cost_cents: number;
  forgotten: { id: number; merchant: string; days_since_last_charge: number; amount_cents: number }[];
  most_expensive: { id: number; merchant: string; monthly_cost_cents: number }[];
}

/**
 * Compute "subscription health": which active subs have not seen a charge
 * in 1.5x their cycle length (i.e., probably forgotten or quietly
 * cancelled merchant-side), plus the top-3 most expensive on a per-month
 * basis.
 */
export function getSubscriptionHealth(): SubscriptionHealth {
  const db = getDb();
  const subs = db
    .prepare(
      `SELECT s.id, s.merchant_id, s.amount_cents, s.currency, s.billing_cycle, s.status,
              m.display_name as merchant_display_name
       FROM subscriptions s JOIN merchants m ON m.id = s.merchant_id`,
    )
    .all() as {
    id: number;
    merchant_id: number;
    amount_cents: number;
    currency: string;
    billing_cycle: SubscriptionRow['billing_cycle'];
    status: SubscriptionRow['status'];
    merchant_display_name: string;
  }[];

  let total_active = 0;
  let total_trial = 0;
  let total_cancelled = 0;
  let monthly_cost_cents = 0;

  // Cycle days helper inlined to avoid a circular import via currency.
  const days = (c: SubscriptionRow['billing_cycle']) =>
    c === 'weekly' ? 7 : c === 'monthly' ? 30 : c === 'quarterly' ? 91 : c === 'annually' ? 365 : 30;
  const monthly = (cents: number, c: SubscriptionRow['billing_cycle']) =>
    c === 'weekly' ? Math.round(cents * (52 / 12))
    : c === 'monthly' ? cents
    : c === 'quarterly' ? Math.round(cents / 3)
    : c === 'annually' ? Math.round(cents / 12)
    : cents;

  const forgotten: SubscriptionHealth['forgotten'] = [];
  const all: { id: number; merchant: string; monthly_cost_cents: number }[] = [];

  for (const s of subs) {
    if (s.status === 'active') total_active++;
    else if (s.status === 'trial') total_trial++;
    else if (s.status === 'cancelled') total_cancelled++;

    if (s.status === 'active' || s.status === 'trial') {
      monthly_cost_cents += monthly(s.amount_cents, s.billing_cycle);
      all.push({
        id: s.id,
        merchant: s.merchant_display_name,
        monthly_cost_cents: monthly(s.amount_cents, s.billing_cycle),
      });
    }

    if (s.status === 'active') {
      // forgotten: latest charge older than 1.5x cycle days
      const latest = db
        .prepare(
          'SELECT charge_date FROM subscription_charges WHERE subscription_id = ? ORDER BY charge_date DESC LIMIT 1',
        )
        .get(s.id) as { charge_date: number } | undefined;
      if (latest) {
        const elapsedDays = Math.floor((Date.now() - latest.charge_date) / (24 * 60 * 60 * 1000));
        if (elapsedDays > 1.5 * days(s.billing_cycle)) {
          forgotten.push({
            id: s.id,
            merchant: s.merchant_display_name,
            days_since_last_charge: elapsedDays,
            amount_cents: s.amount_cents,
          });
        }
      }
    }
  }

  all.sort((a, b) => b.monthly_cost_cents - a.monthly_cost_cents);

  return {
    total_active,
    total_trial,
    total_cancelled,
    monthly_cost_cents,
    forgotten: forgotten.sort((a, b) => b.days_since_last_charge - a.days_since_last_charge).slice(0, 5),
    most_expensive: all.slice(0, 3),
  };
}

export function getMonthlyTotals(months = 12): SummaryByMonth[] {
  const cutoff = Date.now() - months * 31 * 24 * 60 * 60 * 1000;
  return getDb()
    .prepare(
      `SELECT strftime('%Y-%m', transaction_date / 1000, 'unixepoch') as month,
              SUM(total_amount_cents) as total_cents,
              COUNT(*) as count
       FROM receipts WHERE transaction_date >= ?
       GROUP BY month ORDER BY month`,
    )
    .all(cutoff) as SummaryByMonth[];
}

export interface TopMerchant {
  merchant_id: number;
  display_name: string;
  domain: string | null;
  total_cents: number;
  count: number;
}

export function getTopMerchants(limit = 10, days = 365): TopMerchant[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return getDb()
    .prepare(
      `SELECT m.id as merchant_id, m.display_name, m.domain,
              SUM(r.total_amount_cents) as total_cents, COUNT(*) as count
       FROM receipts r JOIN merchants m ON m.id = r.merchant_id
       WHERE r.transaction_date >= ?
       GROUP BY m.id ORDER BY total_cents DESC LIMIT ?`,
    )
    .all(cutoff, limit) as TopMerchant[];
}

export interface MerchantTimelineEntry {
  receipt_id: number;
  email_id: number;
  date: number;
  amount_cents: number;
  currency: string;
  order_number: string | null;
}

export interface MerchantTimelineSummary {
  merchant: MerchantRow;
  total_cents: number;
  count: number;
  first_seen: number | null;
  last_seen: number | null;
  monthly: { month: string; total_cents: number; count: number }[];
  receipts: MerchantTimelineEntry[];
}

/** Full per-merchant view for the timeline page. */
export function getMerchantTimeline(merchantId: number): MerchantTimelineSummary | null {
  const m = getMerchantById(merchantId);
  if (!m) return null;
  const db = getDb();

  const agg = db
    .prepare(
      `SELECT SUM(total_amount_cents) as total_cents, COUNT(*) as count,
              MIN(transaction_date) as first_seen, MAX(transaction_date) as last_seen
       FROM receipts WHERE merchant_id = ?`,
    )
    .get(merchantId) as
    | { total_cents: number | null; count: number; first_seen: number | null; last_seen: number | null }
    | undefined;

  const monthly = db
    .prepare(
      `SELECT strftime('%Y-%m', transaction_date / 1000, 'unixepoch') as month,
              SUM(total_amount_cents) as total_cents,
              COUNT(*) as count
       FROM receipts WHERE merchant_id = ?
       GROUP BY month ORDER BY month`,
    )
    .all(merchantId) as { month: string; total_cents: number; count: number }[];

  const receipts = db
    .prepare(
      `SELECT id as receipt_id, email_id, transaction_date as date, total_amount_cents as amount_cents,
              currency, order_number
       FROM receipts WHERE merchant_id = ? ORDER BY transaction_date DESC LIMIT 200`,
    )
    .all(merchantId) as MerchantTimelineEntry[];

  return {
    merchant: m,
    total_cents: agg?.total_cents ?? 0,
    count: agg?.count ?? 0,
    first_seen: agg?.first_seen ?? null,
    last_seen: agg?.last_seen ?? null,
    monthly,
    receipts,
  };
}

export interface CategoryTotal {
  category: string | null;
  total_cents: number;
  count: number;
  merchant_count: number;
}

/** Aggregate receipt totals by merchant.category over the last `days`. */
export function getCategoryBreakdown(days = 365): CategoryTotal[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return getDb()
    .prepare(
      `SELECT COALESCE(m.category, 'other') as category,
              SUM(r.total_amount_cents) as total_cents,
              COUNT(*) as count,
              COUNT(DISTINCT m.id) as merchant_count
       FROM receipts r JOIN merchants m ON m.id = r.merchant_id
       WHERE r.transaction_date >= ?
       GROUP BY category ORDER BY total_cents DESC`,
    )
    .all(cutoff) as CategoryTotal[];
}

export interface YearOverYearMonth {
  month: string; // 'MM'
  this_year_cents: number;
  last_year_cents: number;
}

export interface PatternByDayOfWeek {
  dow: number; // 0 = Sunday, 6 = Saturday
  total_cents: number;
  count: number;
}

export interface PatternByHour {
  hour: number; // 0..23
  total_cents: number;
  count: number;
}

/** Spending patterns by day-of-week and hour-of-day, last 365 days. */
export function getSpendingPatterns(): {
  by_dow: PatternByDayOfWeek[];
  by_hour: PatternByHour[];
} {
  const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const dowRows = getDb()
    .prepare(
      `SELECT CAST(strftime('%w', transaction_date / 1000, 'unixepoch') AS INTEGER) as dow,
              SUM(total_amount_cents) as total_cents,
              COUNT(*) as count
       FROM receipts WHERE transaction_date >= ?
       GROUP BY dow ORDER BY dow`,
    )
    .all(cutoff) as PatternByDayOfWeek[];
  const hourRows = getDb()
    .prepare(
      `SELECT CAST(strftime('%H', transaction_date / 1000, 'unixepoch') AS INTEGER) as hour,
              SUM(total_amount_cents) as total_cents,
              COUNT(*) as count
       FROM receipts WHERE transaction_date >= ?
       GROUP BY hour ORDER BY hour`,
    )
    .all(cutoff) as PatternByHour[];

  // Pad missing buckets so the chart always has 7/24 entries.
  const padDow: PatternByDayOfWeek[] = [];
  for (let i = 0; i < 7; i++) {
    const r = dowRows.find((x) => x.dow === i);
    padDow.push(r ?? { dow: i, total_cents: 0, count: 0 });
  }
  const padHour: PatternByHour[] = [];
  for (let i = 0; i < 24; i++) {
    const r = hourRows.find((x) => x.hour === i);
    padHour.push(r ?? { hour: i, total_cents: 0, count: 0 });
  }
  return { by_dow: padDow, by_hour: padHour };
}

/** 12-month YoY series: same calendar month this year vs last year. */
export function getYearOverYear(): YearOverYearMonth[] {
  // We compute on the SQLite side: for each of the last 13 months (so we
  // include the current month), grab its receipts, then re-shape into a
  // 12-row series indexed by month.
  const now = Date.now();
  const oneYearMs = 366 * 24 * 60 * 60 * 1000;
  const twoYearsMs = 2 * 366 * 24 * 60 * 60 * 1000;

  const rows = getDb()
    .prepare(
      `SELECT strftime('%Y-%m', transaction_date / 1000, 'unixepoch') as ym,
              SUM(total_amount_cents) as total_cents
       FROM receipts WHERE transaction_date >= ?
       GROUP BY ym ORDER BY ym`,
    )
    .all(now - twoYearsMs) as { ym: string; total_cents: number }[];

  const map = new Map(rows.map((r) => [r.ym, r.total_cents]));

  const out: YearOverYearMonth[] = [];
  const today = new Date(now);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const lastYearD = new Date(d.getFullYear() - 1, d.getMonth(), 1);
    const lastYm = `${lastYearD.getFullYear()}-${String(lastYearD.getMonth() + 1).padStart(2, '0')}`;
    out.push({
      month: ym,
      this_year_cents: map.get(ym) ?? 0,
      last_year_cents: map.get(lastYm) ?? 0,
    });
  }
  // Mark unused params
  void oneYearMs;
  return out;
}
