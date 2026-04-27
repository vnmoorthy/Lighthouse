/**
 * Domain types — the shape of rows after they leave the DB layer.
 *
 * Money is always stored as integer cents in the smallest currency unit. We
 * never round client-side: the LLM extractor produces cents directly, and the
 * UI re-formats with `formatCurrency` from utils.
 */

export type ProcessedStatus = 'pending' | 'classified' | 'done' | 'error' | 'skipped';

export type EmailClass =
  | 'receipt'
  | 'refund'
  | 'subscription_signup'
  | 'subscription_renewal'
  | 'subscription_cancellation'
  | 'trial_started'
  | 'trial_ending_soon'
  | 'price_change'
  | 'shipping_notification'
  | 'not_relevant';

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'unknown';

export type SubscriptionStatus = 'active' | 'cancelled' | 'trial' | 'unknown';

export type AlertType =
  | 'trial_ending'
  | 'price_increase'
  | 'new_subscription'
  | 'duplicate_charge'
  | 'custom';

export interface EmailRow {
  id: number;
  gmail_message_id: string;
  gmail_thread_id: string;
  internal_date: number; // ms since epoch
  from_address: string;
  from_name: string | null;
  subject: string | null;
  snippet: string | null;
  body_text: string | null;
  body_html: string | null;
  raw_headers_json: string | null;
  fetched_at: number;
  processed_at: number | null;
  processed_status: ProcessedStatus;
  classification: EmailClass | null;
  error_message: string | null;
}

export interface MerchantRow {
  id: number;
  canonical_name: string;
  display_name: string;
  domain: string | null;
  logo_url: string | null;
  category: string | null;
  created_at: number;
}

export interface LineItem {
  description: string;
  quantity: number | null;
  unit_price_cents: number | null;
  total_cents: number | null;
}

export interface ReceiptRow {
  id: number;
  email_id: number;
  merchant_id: number;
  total_amount_cents: number;
  currency: string; // ISO 4217 (USD, EUR, …)
  transaction_date: number; // ms since epoch
  line_items_json: string | null;
  order_number: string | null;
  payment_method: string | null;
  confidence: number;
  extraction_model: string;
  raw_extraction_json: string | null;
  user_note: string | null;
  created_at: number;
}

export interface SubscriptionRow {
  id: number;
  merchant_id: number;
  plan_name: string | null;
  amount_cents: number;
  currency: string;
  billing_cycle: BillingCycle;
  next_renewal_date: number | null;
  first_seen_email_id: number | null;
  last_seen_email_id: number | null;
  status: SubscriptionStatus;
  trial_end_date: number | null;
  created_at: number;
  updated_at: number;
}

export interface SubscriptionChargeRow {
  id: number;
  subscription_id: number;
  receipt_id: number | null;
  charge_date: number;
  amount_cents: number;
  currency: string;
}

export interface AlertRow {
  id: number;
  type: AlertType;
  subject_id: number;
  subject_table: string;
  payload_json: string;
  created_at: number;
  dismissed_at: number | null;
}

export interface SyncRunRow {
  id: number;
  started_at: number;
  finished_at: number | null;
  emails_fetched: number;
  emails_processed: number;
  errors_json: string | null;
  status: 'running' | 'finished' | 'failed';
}
