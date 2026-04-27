/**
 * Outbound webhooks for alerts.
 *
 * The user can configure a single webhook URL in Settings (stored in kv).
 * Whenever an alert is created via `insertAlert()`, we dispatch the
 * payload to that URL as a fire-and-forget POST. We also store a small
 * dispatch log so the user can see the last few outcomes.
 *
 * Use cases:
 *   - Pipe alerts into Slack or Discord via a webhook bridge
 *   - Send a Pushover / ntfy / Discord notification
 *   - Store alerts in another system you already trust
 *
 * We deliberately don't try to support Slack-style rich formatting per
 * provider; the payload is a stable, plain JSON shape and integration
 * authors can transform it on their side (e.g. via Zapier).
 */
import { kvGet, kvSet, KV_KEYS } from '../db/kv.js';
import { log } from '../logger.js';

export const WEBHOOK_URL_KEY = 'webhook.url';

void KV_KEYS; // silence unused if our existing kv-keys file doesn't list this one

export interface WebhookPayload {
  type: 'alert';
  alert_type: string;
  subject_table: string;
  subject_id: number;
  payload: unknown;
  created_at: number;
  source: 'lighthouse';
  version: string;
}

export function getWebhookUrl(): string | null {
  return kvGet(WEBHOOK_URL_KEY);
}

export function setWebhookUrl(url: string | null): void {
  if (!url) {
    kvSet(WEBHOOK_URL_KEY, null);
    return;
  }
  // Light validation — must look like an http/https URL.
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('webhook URL must be http(s)');
    }
  } catch (e) {
    throw new Error(`Invalid webhook URL: ${(e as Error).message}`);
  }
  kvSet(WEBHOOK_URL_KEY, url);
}

/** Send an alert to the configured webhook. Queues for retry; never throws. */
export function dispatchWebhook(payload: WebhookPayload): void {
  const url = getWebhookUrl();
  if (!url) return;
  // Lazy import to avoid circular initialization.
  void import('../db/index.js').then(({ getDb }) => {
    const db = getDb();
    const now = Date.now();
    db.prepare(
      `INSERT INTO webhook_deliveries
        (url, payload_json, status, attempts, next_attempt_at, created_at, updated_at)
       VALUES (?, ?, 'pending', 0, ?, ?, ?)`,
    ).run(url, JSON.stringify(payload), now, now, now);
    // Garbage-collect anything older than 30 days.
    db.prepare(
      `DELETE FROM webhook_deliveries WHERE created_at < ? AND status != 'pending'`,
    ).run(now - 30 * 24 * 60 * 60 * 1000);
  });
  // Run the queue immediately. Caller doesn't wait.
  void runWebhookQueue();
}

/**
 * Drain the pending webhook queue. Each delivery gets up to 3 attempts
 * with exponential backoff (5s, 30s, 5min). Idempotent and safe to call
 * concurrently — the per-row UPDATE with a where-status guard keeps two
 * runners from double-firing.
 */
export async function runWebhookQueue(): Promise<{ sent: number; failed: number; pending: number }> {
  const stats = { sent: 0, failed: 0, pending: 0 };
  const { getDb } = await import('../db/index.js');
  const db = getDb();
  const now = Date.now();
  const due = db
    .prepare(
      `SELECT id, url, payload_json, attempts FROM webhook_deliveries
       WHERE status = 'pending' AND next_attempt_at <= ? ORDER BY id LIMIT 32`,
    )
    .all(now) as { id: number; url: string; payload_json: string; attempts: number }[];

  for (const d of due) {
    let ok = false;
    let code: number | null = null;
    let err: string | null = null;
    try {
      const res = await fetch(d.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'lighthouse/0.x' },
        body: d.payload_json,
        signal: AbortSignal.timeout(5_000),
      });
      code = res.status;
      ok = res.ok;
      if (!ok) err = `HTTP ${res.status}`;
    } catch (e) {
      err = (e as Error).message;
    }
    const attempts = d.attempts + 1;
    if (ok) {
      db.prepare(
        `UPDATE webhook_deliveries
         SET status='success', attempts=?, last_status_code=?, last_error=NULL,
             next_attempt_at=NULL, updated_at=?
         WHERE id=?`,
      ).run(attempts, code, Date.now(), d.id);
      stats.sent++;
    } else if (attempts >= 3) {
      db.prepare(
        `UPDATE webhook_deliveries
         SET status='failed', attempts=?, last_status_code=?, last_error=?,
             next_attempt_at=NULL, updated_at=?
         WHERE id=?`,
      ).run(attempts, code, err, Date.now(), d.id);
      stats.failed++;
      log.warn(`Webhook gave up after ${attempts} attempts: ${err ?? code}`);
    } else {
      const backoff = attempts === 1 ? 30_000 : 5 * 60_000; // 30s, 5min
      db.prepare(
        `UPDATE webhook_deliveries
         SET attempts=?, last_status_code=?, last_error=?, next_attempt_at=?, updated_at=?
         WHERE id=?`,
      ).run(attempts, code, err, Date.now() + backoff, code, d.id);
      stats.pending++;
    }
  }
  return stats;
}

export interface WebhookDeliveryRow {
  id: number;
  url: string;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  last_status_code: number | null;
  last_error: string | null;
  next_attempt_at: number | null;
  created_at: number;
  updated_at: number;
}

export async function listWebhookDeliveries(limit = 20): Promise<WebhookDeliveryRow[]> {
  const { getDb } = await import('../db/index.js');
  return getDb()
    .prepare(
      `SELECT id, url, status, attempts, last_status_code, last_error,
              next_attempt_at, created_at, updated_at
       FROM webhook_deliveries ORDER BY id DESC LIMIT ?`,
    )
    .all(limit) as WebhookDeliveryRow[];
}
