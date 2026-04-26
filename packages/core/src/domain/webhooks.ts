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

/** Send an alert to the configured webhook. Fire and forget; never throws. */
export function dispatchWebhook(payload: WebhookPayload): void {
  const url = getWebhookUrl();
  if (!url) return;
  // Don't block the pipeline.
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'lighthouse/0.x' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5_000),
  })
    .then((res) => {
      if (!res.ok) {
        log.warn(`Webhook returned ${res.status}: ${url}`);
      }
    })
    .catch((e) => {
      log.warn(`Webhook dispatch failed: ${(e as Error).message}`);
    });
}
