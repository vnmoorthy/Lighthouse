/**
 * Static FX rates.
 *
 * Multi-currency support, the boring sensible way: a hardcoded rate
 * table that the user can override in `.env` if they want fresher
 * numbers. We deliberately don't fetch live rates — that would be
 * another outbound network call, and Lighthouse's whole pitch is "what
 * leaves my machine?".
 *
 * Receipts are stored in their native currency. The dashboard converts
 * to a display currency at render time. This keeps the source-of-truth
 * exact and the display flexible.
 */
import { kvGet, kvSet } from '../db/kv.js';

export const DISPLAY_CURRENCY_KEY = 'display.currency';

// Static rates against USD. These are reasonable mid-2025 averages —
// users with currency-sensitive needs should override them via the
// LIGHTHOUSE_FX_<CCY> env vars.
//
// Rate semantics: `RATES[ccy]` is the number of `ccy` units per 1 USD.
// So to convert: `usd_amount = native_amount / RATES[native_ccy]`.
const STATIC_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.93,
  GBP: 0.79,
  CAD: 1.37,
  AUD: 1.52,
  JPY: 155.0,
  INR: 84.0,
  CHF: 0.91,
  CNY: 7.25,
  SGD: 1.35,
  MXN: 17.5,
  BRL: 5.1,
  ZAR: 18.6,
  KRW: 1350.0,
  SEK: 10.4,
  NOK: 10.7,
  DKK: 6.95,
  NZD: 1.65,
  HKD: 7.82,
  TWD: 32.5,
};

function envRate(ccy: string): number | null {
  const raw = process.env[`LIGHTHOUSE_FX_${ccy}`];
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function getRate(ccy: string): number {
  const c = (ccy || 'USD').toUpperCase();
  return envRate(c) ?? STATIC_RATES[c] ?? 1.0;
}

export function getDisplayCurrency(): string {
  return (kvGet(DISPLAY_CURRENCY_KEY) || 'USD').toUpperCase();
}

export function setDisplayCurrency(ccy: string): void {
  kvSet(DISPLAY_CURRENCY_KEY, ccy.toUpperCase());
}

/** Convert `cents` from `from_ccy` to `to_ccy`. Both are integer cents. */
export function convertCents(cents: number, fromCcy: string, toCcy: string): number {
  if (!cents) return 0;
  const f = (fromCcy || 'USD').toUpperCase();
  const t = (toCcy || 'USD').toUpperCase();
  if (f === t) return cents;
  const rateFrom = getRate(f); // units per USD
  const rateTo = getRate(t);
  // cents → native units → USD units → target units → cents
  const usd = cents / 100 / rateFrom;
  return Math.round(usd * rateTo * 100);
}

/** Sentinel — the list of currencies we're confident about. */
export function listSupportedCurrencies(): string[] {
  return Object.keys(STATIC_RATES);
}
