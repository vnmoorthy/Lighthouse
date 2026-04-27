/**
 * Tiny fetch wrapper.
 *
 * Bearer token discovery:
 *   1. Check localStorage cache.
 *   2. If missing, fetch /api/__token__ (the API only exposes this to
 *      same-machine requests). Cache.
 *
 * The dashboard is loaded from the same origin as the API, so this all
 * happens transparently.
 */

let cachedToken: string | null = null;

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const cached = localStorage.getItem('lh_api_token');
  if (cached) {
    cachedToken = cached;
    return cached;
  }
  const res = await fetch('/api/__token__', { credentials: 'omit' });
  if (!res.ok) throw new Error(`Could not fetch API token (${res.status}).`);
  const json = (await res.json()) as { token: string };
  cachedToken = json.token;
  localStorage.setItem('lh_api_token', json.token);
  return json.token;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return api<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}

// --- Response types ---------------------------------------------------------

export interface SummaryResponse {
  monthly_spend: { month: string; total_cents: number; count: number }[];
  top_merchants: {
    merchant_id: number;
    display_name: string;
    domain: string | null;
    total_cents: number;
    count: number;
  }[];
  kpis: {
    last_30d_cents: number;
    active_subscriptions: number;
    trial_subscriptions: number;
    monthly_subscription_cost_cents: number;
    annual_run_rate_cents: number;
    open_alerts: number;
    income_30d_cents?: number;
    net_30d_cents?: number;
    savings_rate_30d?: number | null;
    subscriptions_as_pct_of_income?: number | null;
  };
  email_processing: Record<string, number>;
  categories: {
    category: string;
    total_cents: number;
    count: number;
    merchant_count: number;
  }[];
  year_over_year: {
    month: string;
    this_year_cents: number;
    last_year_cents: number;
  }[];
}

export interface ReceiptListItem {
  id: number;
  email_id: number;
  merchant_id: number;
  merchant_display_name: string;
  merchant_domain: string | null;
  total_amount_cents: number;
  currency: string;
  transaction_date: number;
  order_number: string | null;
  payment_method: string | null;
  confidence: number;
}

export interface ReceiptDetail extends ReceiptListItem {
  line_items: { description: string; quantity: number | null; unit_price_cents: number | null; total_cents: number | null }[] | null;
  email: {
    id: number;
    from_address: string;
    from_name: string | null;
    subject: string | null;
    internal_date: number;
    gmail_message_id: string;
    gmail_thread_id: string;
    gmail_url: string;
  } | null;
}

export interface SubscriptionListItem {
  id: number;
  merchant_id: number;
  merchant_display_name: string;
  merchant_domain: string | null;
  plan_name: string | null;
  amount_cents: number;
  currency: string;
  billing_cycle: 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'unknown';
  monthly_cost_cents: number;
  status: 'active' | 'cancelled' | 'trial' | 'unknown';
  next_renewal_date: number | null;
  trial_end_date: number | null;
  first_seen_email_id: number | null;
  last_seen_email_id: number | null;
  created_at: number;
  updated_at: number;
}

export interface SubscriptionDetail extends SubscriptionListItem {
  charges: { id: number; charge_date: number; amount_cents: number; currency: string }[];
  cancel_link: { url: string; hint?: string } | null;
  proof_email: {
    id: number;
    subject: string | null;
    from_address: string;
    internal_date: number;
  } | null;
}

export interface AlertItem {
  id: number;
  type: 'trial_ending' | 'price_increase' | 'new_subscription' | 'duplicate_charge';
  subject_id: number;
  subject_table: string;
  payload: Record<string, unknown>;
  created_at: number;
}

export interface SubscriptionHealth {
  total_active: number;
  total_trial: number;
  total_cancelled: number;
  monthly_cost_cents: number;
  forgotten: { id: number; merchant: string; days_since_last_charge: number; amount_cents: number }[];
  most_expensive: { id: number; merchant: string; monthly_cost_cents: number }[];
}

export interface MerchantItem {
  id: number;
  display_name: string;
  canonical_name: string;
  domain: string | null;
  category: string | null;
}

export interface EmailDetail {
  id: number;
  gmail_message_id: string;
  gmail_thread_id: string;
  gmail_url: string;
  from_address: string;
  from_name: string | null;
  subject: string | null;
  internal_date: number;
  body_text: string | null;
  body_html: string | null;
}

export interface SettingsResponse {
  user: string | null;
  last_sync_at: string | null;
  llm_provider: string;
  llm_model: string;
  db_path: string;
  api: { host: string; port: number };
}

export interface SyncRunDetail {
  id: number;
  started_at: number;
  finished_at: number | null;
  emails_fetched: number;
  emails_processed: number;
  errors_json: string | null;
  status: 'running' | 'finished' | 'failed';
  started_iso: string | null;
  finished_iso: string | null;
}
